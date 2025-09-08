// ws-one-shot-burst.js
// One-shot WebSocket burst that verifies *server ACKs* within a fixed window.
// ESM: ensure "type": "module" in package.json, or run with Node 18+ that supports ESM.

import WebSocket from "ws";
import { randomUUID } from "crypto";

/** ===== ENV (required marked *) =====
 * *WS_ENDPOINT=wss://...
 * *JWT="Bearer eyJ..."                 // don't hardcode
 *
 * ORIGIN=https://app.pett.ai
 * ORIGIN_HEADER=true                   // send Origin header
 *
 * CONNECTIONS=120                      // # of sockets to open
 * AUTH_TIMEOUT_MS=15000                // per-socket auth timeout
 * GLOBAL_READY_TIMEOUT_MS=20000        // max wait for auth phase
 *
 * WINDOW_MS=500                        // measurement window
 * TARGET_ACKS=300                      // required ACKs within the window
 * OVERSEND_PCT=400                     // up to +400% sends (helps overcome drops)
 *
 * // Top-ups inside the window (fraction:perSocket,comma-separated)
 * TOPUPS=0.33:3,0.66:3,0.88:2          // small nudges to catch up
 *
 * // Socket failure policy (meets "restart when one connection fails")
 * EXIT_ON_SOCKET_ERROR=true            // exit(2) on any socket error/close
 *
 * // ACK detection (tune to your server’s reply shape)
 * ACK_TYPE=register_result             // optional; case-insensitive
 * ACK_NONCE_FIELDS=nonce,data.nonce,payload.nonce,result.nonce
 *
 * VERBOSE=false                        // true -> more logs
 */

const required = (k) => {
  const v = process.env[k];
  if (!v) {
    console.error(`Missing required env: ${k}`);
    process.exit(1);
  }
  return v;
};
// const endpoint = required("WS_ENDPOINT");
// const jwt = required("JWT");

const endpoint = "wss://petbot-monorepo-websocket-333713154917.europe-west1.run.app/";
const jwt = "Bearer eyJhbGciOiJFUzI1NiIsInR5cCI6IkpXVCIsImtpZCI6IlU3bU9NMzBNZGJRY3RQMmdoWE4wU0dhTDFIWjNSUWVoZWxkZUNHNF9OaWsifQ.eyJzaWQiOiJjbWY4bzkyNnowMGRmbGEwY3F0MjVuejJhIiwiaXNzIjoicHJpdnkuaW8iLCJpYXQiOjE3NTcxODc4MDgsImF1ZCI6ImNtN2dldjVzNjAwdmJrMmxzajZlMWU5ZzciLCJzdWIiOiJkaWQ6cHJpdnk6Y21mOG85MjhkMDBkaGxhMGM0dTVoc2QxbCIsImV4cCI6MTc1NzE5MTQwOH0.bdnZq8pzvaoEBIbPp7Za4vaslWOq1EUgHWJVU1M9eoOsJ6SriD27bxObTIgzy0avPfxU7Kez2HRjDmkDRfmUDg"

const origin = process.env.ORIGIN ?? "https://app.pett.ai";
const ORIGIN_HEADER = (process.env.ORIGIN_HEADER ?? "true").toLowerCase() === "true";

const CONNECTIONS = +process.env.CONNECTIONS || 120;
const AUTH_TIMEOUT_MS = +process.env.AUTH_TIMEOUT_MS || 15_000;
const GLOBAL_READY_TIMEOUT_MS = +process.env.GLOBAL_READY_TIMEOUT_MS || 20_000;

const WINDOW_MS = +process.env.WINDOW_MS || 500;
const TARGET_ACKS = +process.env.TARGET_ACKS || 200;
const OVERSEND_PCT = +process.env.OVERSEND_PCT || 400;

const TOPUPS =
  (process.env.TOPUPS || "0.33:3,0.66:3,0.88:2")
    .split(",")
    .map((p) => p.trim())
    .filter(Boolean)
    .map((pair) => {
      const [f, c] = pair.split(":");
      return { frac: Math.max(0, Math.min(0.99, parseFloat(f))), perSock: Math.max(0, parseInt(c, 10) || 0) };
    });

const EXIT_ON_SOCKET_ERROR = (process.env.EXIT_ON_SOCKET_ERROR ?? "true").toLowerCase() === "true";

const ACK_TYPE = (process.env.ACK_TYPE ?? "").trim().toLowerCase();
const ACK_NONCE_FIELDS = (process.env.ACK_NONCE_FIELDS ?? "nonce,data.nonce,payload.nonce,result.nonce")
  .split(",")
  .map((s) => s.trim())
  .filter(Boolean);

const VERBOSE = (process.env.VERBOSE ?? "false").toLowerCase() === "true";

const pettName = `ao_${Math.floor(Math.random() * 1000)}_ran_${Math.floor(Math.random() * 1000)}`;
const sockets = [];
let authed = 0;

// ---------- builders (string-first for speed) ----------
const AUTH_MSG = JSON.stringify({
  type: "AUTH",
  data: { params: { authType: "privy", authHash: { hash: jwt } } },
  nonce: randomUUID(), // not used later; OK to randomize once
});

// Prebuilt JSON string parts for REGISTER; we splice the nonce only.
const REG_BASE = `{"type":"REGISTER","data":{"params":{"authType":"privy","registerHash":{"hash":"${jwt}","name":"${pettName}"}}},"nonce":"`;
const REG_SUFFIX = `"}`;
function buildRegisterStringAndNonce() {
  const n = randomUUID();
  return { nonce: n, str: REG_BASE + n + REG_SUFFIX };
}

// ---------- utils ----------
function getPath(obj, path) {
  const parts = path.split(".");
  let cur = obj;
  for (const p of parts) {
    if (cur && Object.prototype.hasOwnProperty.call(cur, p)) cur = cur[p];
    else return undefined;
  }
  return cur;
}
function extractNonce(msg) {
  for (const f of ACK_NONCE_FIELDS) {
    const v = getPath(msg, f);
    if (typeof v === "string" && v.length) return v;
  }
  return undefined;
}
function isAck(msg) {
  if (ACK_TYPE) {
    const t = (msg?.type ?? "").toString().toLowerCase();
    if (t !== ACK_TYPE) return false;
  }
  return typeof extractNonce(msg) === "string";
}
function fatal(label, err) {
  console.error(`❌ ${label}`, err?.message ?? err ?? "");
  if (EXIT_ON_SOCKET_ERROR) process.exit(2);
}

// ---------- ACK accounting ----------
const pending = new Map(); // nonce -> sentAt (ms)
let burstStart = 0;
let burstDeadline = 0;
let ackedInWindow = 0;

function wireAck(ws) {
  ws.on("message", (buf) => {
    try {
      const msg = JSON.parse(buf.toString());
      if (!isAck(msg)) return;
      const n = extractNonce(msg);
      if (!n) return;
      const sentAt = pending.get(n);
      if (sentAt == null) return;
      const now = Date.now();
      if (sentAt >= burstStart && now <= burstDeadline) {
        ackedInWindow++;
        pending.delete(n);
        if (VERBOSE && ackedInWindow % 50 === 0) {
          console.log(`ACKs (window): ${ackedInWindow}/${TARGET_ACKS}`);
        }
      }
    } catch {
      // ignore parse errors; keep hot path lean
    }
  });
}

// ---------- sockets ----------
function connectOne(idx) {
  return new Promise((resolve, reject) => {
    const headers = ORIGIN_HEADER ? { Origin: origin } : {};
    const ws = new WebSocket(endpoint, [], {
      headers,
      perMessageDeflate: false,      // important: avoid CPU/latency
      handshakeTimeout: AUTH_TIMEOUT_MS,
    });

    const authTimer = setTimeout(() => {
      try { ws.terminate(); } catch {}
      console.error(`⏱️  Socket ${idx + 1} auth timeout`);
      resolve(null); // continue with fewer sockets
    }, AUTH_TIMEOUT_MS);

    ws.on("open", () => {
      try { ws._socket?.setNoDelay(true); } catch {}
      ws.send(AUTH_MSG, { compress: false });
    });

    ws.on("message", (data) => {
      try {
        const msg = JSON.parse(data.toString());
        msg.pet && console.log(`Tokens = ${Math.round(Number(msg?.pet?.PetTokens?.tokens) / Number(1000000000000000000))}, Error = ${msg?.error}`);
        if ((msg.type ?? "").toString().toLowerCase() === "auth_result") {
          clearTimeout(authTimer);
          authed++;
          sockets.push(ws);
          resolve(ws);
        }
      } catch {
        // ignore
      }
    });

    ws.on("error", (e) => {
      clearTimeout(authTimer);
      console.error(`⚠️  Socket ${idx + 1} error:`, e.message);
      if (EXIT_ON_SOCKET_ERROR) return reject(e);
      resolve(null);
    });
    ws.on("close", (code, reason) => {
      clearTimeout(authTimer);
      console.error(`⚠️  Socket ${idx + 1} closed (${code}) ${reason || ""}`);
      if (EXIT_ON_SOCKET_ERROR) return reject(new Error(`closed ${code}`));
      resolve(null);
    });
  });
}

// ---------- burst logic ----------
async function topUpAtFraction(frac, perSock) {
  const due = Math.floor(WINDOW_MS * frac);
  const wait = Math.max(0, burstStart + due - Date.now());
  if (wait > 0) await new Promise((r) => setTimeout(r, wait));
  if (Date.now() >= burstDeadline || ackedInWindow >= TARGET_ACKS) return;

  for (const sock of sockets) {
    if (Date.now() >= burstDeadline || ackedInWindow >= TARGET_ACKS) break;
    if (sock.readyState !== WebSocket.OPEN) continue;
    try { sock._socket?.cork(); } catch {}
    for (let i = 0; i < perSock; i++) {
      if (Date.now() >= burstDeadline || ackedInWindow >= TARGET_ACKS) break;
      const { nonce, str } = buildRegisterStringAndNonce();
      pending.set(nonce, Date.now());
      try { sock.send(str, { compress: false }); } catch {}
    }
    try { sock._socket?.uncork(); } catch {}
  }
}

async function sendOneShotBurst() {
  sockets.forEach(wireAck);

  const maxSends = Math.ceil(TARGET_ACKS * (1 + OVERSEND_PCT / 100));
  const live = sockets.filter((s) => s.readyState === WebSocket.OPEN);
  const per = Math.floor(maxSends / Math.max(1, live.length));
  let remainder = maxSends % Math.max(1, live.length);

  burstStart = Date.now();
  burstDeadline = burstStart + WINDOW_MS;
  ackedInWindow = 0;

  let sent = 0;

  // Front-load as much as possible (fast string path, corked)
  for (const sock of live) {
    if (Date.now() >= burstDeadline) break;
    const quota = per + (remainder-- > 0 ? 1 : 0);
    try { sock._socket?.cork(); } catch {}
    for (let i = 0; i < quota; i++) {
      if (Date.now() >= burstDeadline) break;
      const { nonce, str } = buildRegisterStringAndNonce();
      pending.set(nonce, Date.now());
      try { sock.send(str, { compress: false }); sent++; } catch {}
    }
    try { sock._socket?.uncork(); } catch {}
  }

  // Schedule top-ups
  for (const { frac, perSock } of TOPUPS) {
    // Fire and forget (sequential awaits keep order)
    // eslint-disable-next-line no-await-in-loop
    await topUpAtFraction(frac, perSock);
  }

  // Wait to the end of the window
  const remain = burstDeadline - Date.now();
  if (remain > 0) await new Promise((r) => setTimeout(r, remain));

  console.log(
    `📊 One-shot result: sockets=${live.length}/${CONNECTIONS} target=${TARGET_ACKS} window=${WINDOW_MS}ms sent≈${sent} acked=${ackedInWindow}`
  );

  if (ackedInWindow >= TARGET_ACKS) {
    console.log("✅ Success: required ACKs achieved within window.");
    process.exit(0);
  } else {
    console.log("❌ Not enough ACKs within window.");
    process.exit(1);
  }
}

// ---------- main ----------
process.on("uncaughtException", (e) => fatal("uncaughtException", e));
process.on("unhandledRejection", (e) => fatal("unhandledRejection", e));

(async function main() {
  console.log(`Pett Name = ${pettName}`);
  console.log(`🔌 Opening ${CONNECTIONS} sockets…`);

  const opens = [];
  for (let i = 0; i < CONNECTIONS; i++) opens.push(connectOne(i));

  // Wait for sockets or global timeout
  await Promise.race([
    Promise.allSettled(opens),
    new Promise((r) => setTimeout(r, GLOBAL_READY_TIMEOUT_MS)),
  ]);

  const live = sockets.filter((s) => s.readyState === WebSocket.OPEN).length;
  console.log(`✅ Authenticated ${authed} sockets; live=${live}/${CONNECTIONS}`);

  if (live === 0) {
    console.error("No live sockets. Aborting.");
    process.exit(2);
  }

  await sendOneShotBurst();
})();
