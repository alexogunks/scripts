// load-blaster.js
import fs from "fs";
import path from "path";
import WebSocket from "ws";
import { HttpsProxyAgent } from "https-proxy-agent";
import { SocksProxyAgent } from "socks-proxy-agent";
import { v4 as uuidv4 } from "uuid";

const ENDPOINT = process.env.WS_ENDPOINT || "wss://ws.pett.ai/";
const ORIGIN = process.env.WS_ORIGIN || "https://app.pett.ai";
const PROXY_FILE = process.env.PROXY_FILE || path.resolve(process.cwd(), "proxies.txt");
const TOTAL_SOCKETS_OVERRIDE = process.env.TOTAL_SOCKETS ? Number(process.env.TOTAL_SOCKETS) : 2;
const STAGGER_MS = Number(process.env.STAGGER_MS || 120);
const JITTER_MS = Number(process.env.JITTER_MS || 60);
const CONNECT_TIMEOUT_MS = Number(process.env.CONNECT_TIMEOUT_MS || 20000);
const SUMMARY_MS = Number(process.env.SUMMARY_MS || 10000);
const MAX_RECONNECT_ATTEMPTS = Number(process.env.MAX_RECONNECT_ATTEMPTS || 5);
const MOVE_PROXY_ON_429 = true; // rotate to next proxy when 429 appears

// paste your jwt/pettName or let script use env override
const JWT = process.env.JWT || "Bearer eyJhbGciOiJFUzI1NiIsInR5cCI6IkpXVCIsImtpZCI6IlU3bU9NMzBNZGJRY3RQMmdoWE4wU0dhTDFIWjNSUWVoZWxkZUNHNF9OaWsifQ.eyJzaWQiOiJjbWgyOXZoazgwMHg4bDcwY3N3N29iMjRsIiwiaXNzIjoicHJpdnkuaW8iLCJpYXQiOjE3NjIyMTUzNjUsImF1ZCI6ImNtN2dldjVzNjAwdmJrMmxzajZlMWU5ZzciLCJzdWIiOiJkaWQ6cHJpdnk6Y21kMTUxdzhtMDQwM2xlMG02NDV1c3JrcSIsImV4cCI6MTc2MjIzNjk2NX0.0Sg4fbYEZ4vO8fYmb3JbuK1hwCXNozY2X63rdHUc8U_Jt_pDyjTRcKW5WST9_U8nF--lGGNmOe0yV3iN8CzDZA"
const pettNameBase = process.env.PETT_NAME || `tests_${Math.floor(Math.random()*999999)}_02`;

// KEEP original semantics: type can be changed by switchType
let type = process.env.INIT_TYPE || "food"; // "register" | "withdraw" | "food" | "atm" | "dice" | "jump" | "door"
const useAtm = process.env.USE_ATM === "true" || false;

// helper funcs
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const uniqueNonce = () => uuidv4();

const withdrawalIds = [
  "f5f13320-3c17-4ac2-926a-7533efee7c9f"
];
const pickWithdrawalId = () => withdrawalIds[Math.floor(Math.random() * withdrawalIds.length)];
const rand1to10 = () => 10;

// message builders (copied from you)
const makeRegisterString = (name) =>
  JSON.stringify({
    type: "REGISTER",
    data: { params: { authType: "privy", registerHash: { hash: JWT, name } } },
    nonce: uniqueNonce(),
  });

const makeAuthString = () =>
  JSON.stringify({
    type: "AUTH",
    data: { params: { authType: "privy", authHash: { hash: JWT } } },
    nonce: uniqueNonce(),
  });

const makeWithdrawString = (withdrawalId) =>
  JSON.stringify({
    type: "WITHDRAWAL_USE",
    data: { params: { withdrawalId } },
    nonce: uniqueNonce(),
  });

const makeJumpString = (withdrawalId) =>
  JSON.stringify({
    type: "WITHDRAWAL_JUMP",
    data: { params: { withdrawalId } },
    nonce: uniqueNonce(),
  });

const makeDoorString = () =>
  JSON.stringify({
    type: "PLAY_DOORS",
    data: {},
    nonce: uniqueNonce(),
  });

const makeBuyString = () => {
  JSON.stringify({
    type: "CONSUMABLES_BUY",
    data: { params: { foodId: "ENERGIZER", amount: 1 } },
    nonce: uniqueNonce(),
  })
  return JSON.stringify({
    "type": "WITHDRAWAL_USE",
    "data": {
        "params": {
            "withdrawalId": "e7bddcc2-0991-49d7-a62f-7eca37ac8dc3"
        }
    },
    "nonce": uniqueNonce()
})
};

let tokenBalance = 0;
const makeAtmString = () => {
  let amountToSend = Number(Math.floor(tokenBalance - Number(tokenBalance * 10 / 100)));
  return JSON.stringify({
    type: "TRANSFER",
    data: {
        params: {
            petTo: "23d430f9-e9f8-4788-a1a3-97c9476dad28",
            amount: Math.round(Number(amountToSend - Number(amountToSend * 0.1 / 100)))
        }
    },
    nonce: uniqueNonce()
  });
};

const chooseDiceBet = (mode = "number") => {
  if (mode === "number") {
    if (Math.random() < 0.7) return Math.random() < 0.5 ? 3 : 4;
    return Math.floor(Math.random() * 6) + 1;
  }
  return mode.toUpperCase() === "EVEN" ? "EVEN" : "ODD";
};
const makeDiceString = (betAmount, mode) =>
  JSON.stringify({
    type: "PLAY_DICE",
    data: {
      params: {
        betAmount,
        selectedBet: { number: chooseDiceBet(mode), type: "number" },
      },
    },
    nonce: uniqueNonce(),
  });

// configs (kept your numbers)
const CONFIGS = {
  register: { TOTAL_SOCKETS: 25, REQUESTS_PER_SOCKET: 1500, BLAST_DURATION_MS: 1000, REST_BETWEEN_WAVES_MS: 30000 },
  withdraw: { TOTAL_SOCKETS: 10, REQUESTS_PER_SOCKET: 1, BLAST_DURATION_MS: 40, REST_BETWEEN_WAVES_MS: 1000 },
  food: { TOTAL_SOCKETS: 1, REQUESTS_PER_SOCKET: 4, BLAST_DURATION_MS: 40, REST_BETWEEN_WAVES_MS: 500 },
  atm: { TOTAL_SOCKETS: 3, REQUESTS_PER_SOCKET: 1, BLAST_DURATION_MS: 40, REST_BETWEEN_WAVES_MS: 2000 },
  door: { TOTAL_SOCKETS: 10, REQUESTS_PER_SOCKET: 20, BLAST_DURATION_MS: 40, REST_BETWEEN_WAVES_MS: 500 },
  dice: { TOTAL_SOCKETS: 10, REQUESTS_PER_SOCKET: 20, BLAST_DURATION_MS: 40, REST_BETWEEN_WAVES_MS: 500 },
  jump: { TOTAL_SOCKETS: 3, REQUESTS_PER_SOCKET: 20, BLAST_DURATION_MS: 40, REST_BETWEEN_WAVES_MS: 500 },
};

if (TOTAL_SOCKETS_OVERRIDE) {
  if (CONFIGS[type]) CONFIGS[type].TOTAL_SOCKETS = TOTAL_SOCKETS_OVERRIDE;
}

// state
let sockets = []; // { ws, id, didAuth, withdrawalId, proxy, attempts }
let totalSent = 0;
let totalReceived = 0;
let waveCounter = 0;
let blasting = false;
let sendingStarted = false;
let currentLevel = 0;
let levelAim = 25;
let pendingOpenType = null;
let blastTimer = null;
let restTimer = null;
let atmInterval = null;

// proxies
function loadProxies() {
  if (!fs.existsSync(PROXY_FILE)) return [];
  const lines = fs.readFileSync(PROXY_FILE, "utf8").split("\n").map(l => l.trim()).filter(Boolean);
  return lines;
}
const proxies = loadProxies();
const proxyStats = new Map(); // proxy -> {attempted, connected, failed}
for (const p of proxies) proxyStats.set(p, { attempted: 0, connected: 0, failed: 0 });

function makeAgentFromProxy(proxyUrl) {
  if (!proxyUrl) return undefined;
  const lower = proxyUrl.toLowerCase();
  try {
    if (lower.startsWith("socks")) return new SocksProxyAgent(proxyUrl);
    return new HttpsProxyAgent(proxyUrl);
  } catch (e) {
    console.error("bad proxy:", proxyUrl, e.message);
    return undefined;
  }
}

function pickProxyFor(index) {
  if (!proxies.length) return undefined;
  return proxies[index % proxies.length];
}

function sendActionForSocket(sock) {
  if (sock.ws.readyState !== WebSocket.OPEN) return;
  if (new Set(["withdraw","food","atm","dice","door","jump"]).has(type) && !sock.didAuth) {
    sock.ws.send(makeAuthString());
    sock.didAuth = true;
    return;
  }
  switch (type) {
    case "register": sock.ws.send(makeRegisterString(`${pettNameBase}_${sock.id}`)); break;
    case "withdraw": sock.ws.send(makeWithdrawString(sock.withdrawalId ?? (sock.withdrawalId = pickWithdrawalId()))); break;
    case "food": sock.ws.send(makeBuyString()); break;
    case "atm": sock.ws.send(makeAtmString()); break;
    case "door": sock.ws.send(makeDoorString()); break;
    case "dice": sock.ws.send(makeDiceString(5000, "number")); break;
    case "jump": sock.ws.send(makeJumpString(sock.withdrawalId ?? (sock.withdrawalId = pickWithdrawalId()))); break;
    default: break;
  }
}

function blastWave() {
  if (type === "atm") return;
  const cfg = CONFIGS[type];
  const live = sockets.filter((s) => s.ws.readyState === WebSocket.OPEN);
  if (!live.length) {
    sendingStarted = false;
    blasting = false;
    return;
  }
  blasting = true;
  waveCounter++;
  let sentThisWave = 0;
  const interval = Math.max(1, Math.floor(cfg.BLAST_DURATION_MS / Math.max(1, cfg.REQUESTS_PER_SOCKET)));
  for (const sock of live) {
    for (let j = 0; j < cfg.REQUESTS_PER_SOCKET; j++) {
      setTimeout(() => {
        try { sendActionForSocket(sock); sentThisWave++; } catch {}
      }, j * interval);
    }
  }
  blastTimer = setTimeout(() => {
    totalSent += sentThisWave;
    console.log(`⚡ Wave #${waveCounter}: sent=${sentThisWave} · liveSockets=${live.length} · totalSent=${totalSent}`);
    blasting = false;
    restTimer = setTimeout(blastWave, cfg.REST_BETWEEN_WAVES_MS);
  }, cfg.BLAST_DURATION_MS + 20);
}

function startAtmLoop() {
  clearAtmLoop();
  const cfg = CONFIGS.atm;
  atmInterval = setInterval(() => {
    const live = sockets.filter((s) => s.ws.readyState === WebSocket.OPEN);
    if (!live.length) return;
    if (!useAtm) return console.log("🏧 No ATM!");
    for (const sock of live) sendActionForSocket(sock);
    console.log("🏧 ATM tick sent across live sockets");
  }, cfg.REST_BETWEEN_WAVES_MS);
}
function clearAtmLoop() {
  if (atmInterval) { clearInterval(atmInterval); atmInterval = null; }
}

function startSendingIfReady() {
  const cfg = CONFIGS[type];
  if (sendingStarted) return;
  if (sockets.length !== cfg.TOTAL_SOCKETS) return;
  sendingStarted = true;
  console.log(`🚀 All ${cfg.TOTAL_SOCKETS} sockets connected — starting ${type.toUpperCase()} loop`);
  if (type === "atm") startAtmLoop();
  else blastWave();
}

function switchType(newType) {
  if (type === newType) return;
  console.log(`🔄 Switching type: ${type} → ${newType}`);
  if (blastTimer) clearTimeout(blastTimer);
  if (restTimer) clearTimeout(restTimer);
  clearAtmLoop();
  blasting = false;
  sendingStarted = false;
  pendingOpenType = newType;
  for (const s of sockets) try { s.ws.close(); } catch {}
}

function openPendingTypeIfAny() {
  if (!pendingOpenType) return;
  if (sockets.length !== 0) return;
  type = pendingOpenType;
  pendingOpenType = null;
  if (type === "food") CONFIGS[type].TOTAL_SOCKETS = rand1to10();
  console.log(`🔌 Opening ${CONFIGS[type].TOTAL_SOCKETS} sockets in ${type.toUpperCase()} mode...`);
  for (let i = 0; i < CONFIGS[type].TOTAL_SOCKETS; i++) {
    setTimeout(() => connectSocket(i + 1), i * 100);
  }
}

function connectSocket(socketId, proxyUrl, attempt=0) {
  const headers = { Origin: ORIGIN, "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64)", "X-Loadtest-Nonce": uniqueNonce() };
  const agent = makeAgentFromProxy(proxyUrl);
  const ws = new WebSocket(ENDPOINT, { headers, agent, perMessageDeflate: false, handshakeTimeout: CONNECT_TIMEOUT_MS });

  const sock = { ws, id: socketId, didAuth: false, withdrawalId: undefined, proxy: proxyUrl, attempts: attempt };
  sockets.push(sock);
  if (proxyUrl) proxyStats.get(proxyUrl).attempted++;

  const cleanupAndMaybeReconnect = async (reason) => {
    sockets = sockets.filter(s => s !== sock);
    try { ws.terminate(); } catch {}
    if (reason?.is429) {
      console.log(`🚫 Socket ${socketId} got 429. attempt=${attempt}`);
      if (attempt < MAX_RECONNECT_ATTEMPTS) {
        const nextProxy = MOVE_PROXY_ON_429 ? pickProxyFor(socketId + attempt + 1) : proxyUrl;
        const backoff = 1000 * Math.pow(2, attempt);
        await sleep(backoff + Math.floor(Math.random()*500));
        connectSocket(socketId, nextProxy, attempt+1);
        return;
      }
    } else if (attempt < MAX_RECONNECT_ATTEMPTS) {
      const backoff = 500 + Math.floor(Math.random()*1000);
      await sleep(backoff);
      connectSocket(socketId, pickProxyFor(socketId + attempt), attempt+1);
      return;
    }
  };

  let connectTimer = setTimeout(() => {
    if (ws.readyState !== WebSocket.OPEN) {
      console.log(`⏱ Socket ${socketId} connect timeout`);
      cleanupAndMaybeReconnect({ timeout: true });
    }
  }, CONNECT_TIMEOUT_MS + 500);

  ws.on("open", () => {
    clearTimeout(connectTimer);
    ws.isAlive = true;
    ws.ping();
    const livePingIv = setInterval(() => {
      if (ws.readyState === WebSocket.OPEN) ws.ping();
      else clearInterval(livePingIv);
    }, 30000);

    if (proxyUrl) proxyStats.get(proxyUrl).connected++;
    console.log(`✅ Socket ${socketId} connected via ${proxyUrl ?? "direct"} (${sockets.length}/${CONFIGS[type].TOTAL_SOCKETS})`);
    startSendingIfReady();
  });

  ws.on("message", async (m) => {
    let msg;
    try { msg = JSON.parse(m.toString()); } catch { return; }
    console.log(msg);
    const lower = (msg?.error && String(msg.error).toLowerCase()) || "";
    if (lower && lower.includes("user already created")) {
      totalReceived += 1;
      if (totalReceived > 1 && type !== "food" && type !== "atm") {
        await sleep(3000);
        switchType("food");
      }
    }
    // if (msg?.type == 'data') console.log(msg);
    if (msg?.pet?.PetStats?.level != null) {
      currentLevel = Number(msg.pet.PetStats.level);
      if (currentLevel >= levelAim && type !== "atm" && useAtm === true) switchType("atm");
    }
    if (msg?.pet?.PetTokens?.tokens != null) {
      tokenBalance = Number(msg.pet.PetTokens.tokens);
    }
    // handle server-side 429 message if sent inside websocket payload
    if (lower && lower.includes("too many requests")) {
      console.log(`⚠ server payload 429 detected on socket ${socketId}`);
      await cleanupAndMaybeReconnect({ is429: true });
    }
  });

  ws.on("close", async (code, reason) => {
    sockets = sockets.filter(s => s !== sock);
    if (code === 1008 || code === 429 || String(reason).toLowerCase().includes("too many requests")) {
      await cleanupAndMaybeReconnect({ is429: true });
      return;
    }
    if (ws._closeFrameReceived || ws._closeFrameSent) {
      // normal
    } else {
      // abnormal
    }
    if (sockets.length === 0) openPendingTypeIfAny();
  });

  ws.on("error", async (err) => {
    const em = String(err?.message || err || "");
    console.error(`❌ Socket ${socketId} error via ${proxyUrl ?? "direct"}:`, em);
    if (em.includes("Unexpected server response: 429") || em.toLowerCase().includes("429")) {
      await cleanupAndMaybeReconnect({ is429: true });
    } else {
      if (proxyUrl) proxyStats.get(proxyUrl).failed++;
      await cleanupAndMaybeReconnect({ error: true });
    }
  });
}

// boot: open initial sockets of configured type (staggered + jitter)
const initialTotal = CONFIGS[type].TOTAL_SOCKETS;
console.log(`🔌 Opening ${initialTotal} sockets in ${type.toUpperCase()} mode... (proxies=${proxies.length})`);
for (let i = 0; i < initialTotal; i++) {
  const proxy = pickProxyFor(i);
  const delay = i * STAGGER_MS + Math.floor(Math.random()*JITTER_MS);
  setTimeout(() => connectSocket(i+1, proxy), delay);
}

// periodic summary
setInterval(() => {
  const byProxy = proxies.map(p => ({ proxy: p, ...proxyStats.get(p) })).slice(0,50);
  console.log(`[summary] time=${new Date().toISOString()} attempted=${sockets.length+0} live=${sockets.filter(s=>s.ws && s.ws.readyState===WebSocket.OPEN).length} totalSent=${totalSent} totalReceived=${totalReceived} waves=${waveCounter} type=${type}`);
  if (proxies.length) console.log(" proxyStats sample:", JSON.stringify(byProxy, null, 0));
}, SUMMARY_MS);

// graceful shutdown
process.on("SIGINT", () => {
  console.log("SIGINT — closing sockets");
  for (const s of sockets) try { s.ws.close(); } catch {}
  process.exit(0);
});