import fs from "fs";
import { performance } from "perf_hooks";

const CONFIG = {
  baseUrl: "https://cloud.lypexchange.vip/api", // server base (no trailing slash)
  sendCodePath: "/app/register/sendEmailCode",
  registerPath: "/app/user/register",

  reqToSend: 500,               // number of parallel flows to start
  verifyTimeoutMs: 45000,      // how long to wait for email code (ms)
  verifyPollIntervalMs: 1500,  // poll interval (ms)

  passwordForMailtm: "TempPass123!", // password for created mail.tm accounts
  accountPassword: "Creeper123.",     // password to register on your server

  outputCsv: true,
  csvPath: "./register_results.csv",
  extraHeaders: {
    // add server headers if required, e.g. Authorization
    // "Authorization": "Bearer ...",
  },
};

// ---- mail.tm helpers ----
const MAILTM_API = "https://api.mail.tm";

async function getMailTmDomains() {
  const res = await fetch(`${MAILTM_API}/domains`);
  if (!res.ok) throw new Error("mail.tm /domains failed " + res.status);
  const j = await res.json();
  // domains list is in hydra:member or array
  const domains = j["hydra:member"] || j;
  return domains.map(d => d.domain);
}

function randLocal() {
  return "mt" + Math.random().toString(36).slice(2, 10);
}

async function createMailTmAccount(address, password) {
  const res = await fetch(`${MAILTM_API}/accounts`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ address, password })
  });
  // 201 created or 422 if exists; handle both
  if (res.status === 201 || res.status === 200) return true;
  const txt = await res.text();
  if (res.status === 422 && txt.includes("already exists")) return true;
  throw new Error(`create account failed ${res.status} ${txt}`);
}

async function getMailTmToken(address, password) {
  const res = await fetch(`${MAILTM_API}/token`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ address, password })
  });
  if (!res.ok) {
    const t = await res.text();
    throw new Error(`token failed ${res.status} ${t}`);
  }
  const j = await res.json();
  return j.token;
}

async function listMessages(token) {
  const res = await fetch(`${MAILTM_API}/messages`, {
    headers: { Authorization: `Bearer ${token}` }
  });
  if (!res.ok) return [];
  const j = await res.json();
  return j["hydra:member"] || j;
}

async function getMessage(token, id) {
  const res = await fetch(`${MAILTM_API}/messages/${id}`, {
    headers: { Authorization: `Bearer ${token}` }
  });
  if (!res.ok) return null;
  return await res.json();
}

// ---- server helpers ----
function serverPost(path, payload) {
  const url = (CONFIG.baseUrl + path).replace(/\/{2,}/, "/").replace(":/", "://");
  return fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...CONFIG.extraHeaders },
    body: JSON.stringify(payload),
  });
}

// ---- single full flow ----
async function fullFlow(idx, domainChoice) {
  const start = performance.now();
  const out = {
    idx, email: null, code: null,
    sendStatus: null, sendBody: null,
    registerStatus: null, registerBody: null,
    success: false, error: null, timeMs: null, ts: new Date().toISOString()
  };

  try {
    // create unique mail address
    const local = randLocal();
    const domain = domainChoice;
    const address = `${local}@${domain}`;
    out.email = address;

    // create account (mail.tm)
    await createMailTmAccount(address, CONFIG.passwordForMailtm);
    const token = await getMailTmToken(address, CONFIG.passwordForMailtm);

    // tell your server to send code
    const sendRes = await serverPost(CONFIG.sendCodePath, { email: address, type: 1 });
    out.sendStatus = sendRes.status;
    out.sendBody = await safeRead(sendRes);

    // poll for messages until timeout
    const deadline = Date.now() + CONFIG.verifyTimeoutMs;
    let found = null;
    while (Date.now() < deadline && !found) {
      const msgs = await listMessages(token);
      if (msgs && msgs.length > 0) {
        // check latest messages
        for (let m of msgs) {
          const full = await getMessage(token, m.id);
          if (!full) continue;
          const text = `${full.text ?? ""}\n${full.html ?? ""}\n${full.intro ?? ""}`;
          const match = text.match(/\b\d{6}\b/);
          if (match) { found = match[0]; break; }
        }
      }
      if (!found) await delay(CONFIG.verifyPollIntervalMs);
    }
    if (!found) throw new Error("code_not_found");

    out.code = found;

    // register on your server
    const regPayload = {
      type: 2,
      country_code: "",
      country_id: 1,
      account: address,
      code: found,
      password: CONFIG.accountPassword,
      password_confirmation: CONFIG.accountPassword,
      invite_code: "89231840"
    };
    const regRes = await serverPost(CONFIG.registerPath, regPayload);
    out.registerStatus = regRes.status;
    out.registerBody = await safeRead(regRes);
    out.success = regRes.ok;

  } catch (err) {
    out.error = err && err.message ? err.message : String(err);
  }

  out.timeMs = Math.round(performance.now() - start);
  return out;
}

async function safeRead(res) {
  try {
    const txt = await res.text();
    try { return JSON.parse(txt); } catch { return txt; }
  } catch { return null; }
}
function delay(ms) { return new Promise(r => setTimeout(r, ms)); }

// ---- burst launcher ----
async function runBurst() {
  console.log("Fetching mail.tm domains...");
  const domains = await getMailTmDomains();
  if (!domains || domains.length === 0) throw new Error("no mail.tm domains");
  console.log("mail.tm domains:", domains.slice(0,5));

  // choose domain (use first)
  const domainChoice = domains[0];

  console.log(`Starting burst: ${CONFIG.reqToSend} parallel flows using domain ${domainChoice}`);
  const tasks = [];
  for (let i = 0; i < CONFIG.reqToSend; i++) tasks.push(delay(i * 5000).then(() => fullFlow(i + 1, domainChoice)));

  const start = performance.now();
  const settled = await Promise.allSettled(tasks);
  const duration = Math.round(performance.now() - start);

  const results = settled.map((s, i) => s.status === "fulfilled" ? s.value : {
    idx: i + 1, email: null, code: null, success: false, error: s.reason?.message || String(s.reason), timeMs: null
  });

  // summary
  const ok = results.filter(r => r.success).length;
  console.log(`=== SUMMARY ===\nTotal: ${results.length} | Success: ${ok} | Fail: ${results.length - ok}\nWall time: ${duration} ms`);

  if (CONFIG.outputCsv) saveCsv(results, CONFIG.csvPath);
  console.log("Sample:", results.slice(0,8).map(r => ({ idx: r.idx, email: r.email, sendStatus: r.sendStatus, code: r.code, regStatus: r.registerStatus, success: r.success, error: r.error })));
}

function saveCsv(rows, path) {
  const head = ["idx","email","sendStatus","sendBody","code","registerStatus","registerBody","success","error","timeMs","ts"];
  const lines = [head.join(",")];
  for (const r of rows) {
    const line = [
      r.idx ?? "", r.email ?? "", r.sendStatus ?? "", escapeCsv(JSON.stringify(r.sendBody ?? "")),
      r.code ?? "", r.registerStatus ?? "", escapeCsv(JSON.stringify(r.registerBody ?? "")),
      r.success ? "1" : "0", escapeCsv(r.error ?? ""), r.timeMs ?? "", r.ts ?? ""
    ].join(",");
    lines.push(line);
  }
  fs.writeFileSync(path, lines.join("\n"));
  console.log("Saved", path);
}
function escapeCsv(s) { if (s == null) return '""'; return `"${String(s).replace(/"/g,'""')}"`; }

// ---- run ----
runBurst().catch(err => { console.error("Fatal:", err); process.exit(1); });
