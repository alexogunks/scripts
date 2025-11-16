import WebSocket from "ws";
import { v4 as uuidv4 } from "uuid";

const ENDPOINT = process.env.WS_ENDPOINT || "wss://ws.pett.ai/";
const ORIGIN = process.env.WS_ORIGIN || "https://app.pett.ai";
const TOTAL_SOCKETS = Number(process.env.TOTAL_SOCKETS || 15);
const STAGGER_MS = Number(process.env.STAGGER_MS || 120);
const JITTER_MS = Number(process.env.JITTER_MS || 60);
const CONNECT_TIMEOUT_MS = Number(process.env.CONNECT_TIMEOUT_MS || 20000);
const SUMMARY_MS = Number(process.env.SUMMARY_MS || 10000);
const MAX_RECONNECT_ATTEMPTS = Number(process.env.MAX_RECONNECT_ATTEMPTS || 100);

const JWT = process.env.JWT || "Bearer eyJhbGciOiJFUzI1NiIsInR5cCI6IkpXVCIsImtpZCI6IlU3bU9NMzBNZGJRY3RQMmdoWE4wU0dhTDFIWjNSUWVoZWxkZUNHNF9OaWsifQ.eyJzaWQiOiJjbWhqdXZjeGowMG4zaWUwY3lpcnFzaTJjIiwiaXNzIjoicHJpdnkuaW8iLCJpYXQiOjE3NjIyMTc2MTgsImF1ZCI6ImNtN2dldjVzNjAwdmJrMmxzajZlMWU5ZzciLCJzdWIiOiJkaWQ6cHJpdnk6Y21oanV2Y3o4MDBuNWllMGNnZ3FjYWg3cyIsImV4cCI6MTc2MjIzOTIxOH0.rXNjvKU3oVgzR7Umn5Fs1SXECie6lpYtiAx2pjG6NX6DGjRoYWJ_AMqrkMEY6f8OnzC4bQKRn2LXiTEAJDbgWQ"
const pettNameBase = process.env.PETT_NAME || `tests_${Math.floor(Math.random() * 999999)}_02`;
let type = process.env.INIT_TYPE || "food";
const useAtm = process.env.USE_ATM === "true" || false;

// utils
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const uniqueNonce = () => uuidv4();

// messages
const makeAuthString = () => JSON.stringify({
  type: "AUTH",
  data: { params: { authType: "privy", authHash: { hash: JWT } } },
  nonce: uniqueNonce(),
});
const makeRegisterString = (name) => JSON.stringify({
  type: "REGISTER",
  data: { params: { authType: "privy", registerHash: { hash: JWT, name } } },
  nonce: uniqueNonce(),
});

const CONFIGS = {
  register: { TOTAL_SOCKETS, REQUESTS_PER_SOCKET: 20, BLAST_DURATION_MS: 40, REST_BETWEEN_WAVES_MS: 1000 },
  food: { TOTAL_SOCKETS, REQUESTS_PER_SOCKET: 15, BLAST_DURATION_MS: 40, REST_BETWEEN_WAVES_MS: 1000 },
};

let sockets = [];
let totalSent = 0;
let totalReceived = 0;
let waveCounter = 0;
let blasting = false;
let sendingStarted = false;

function sendActionForSocket(sock) {
  if (sock.ws.readyState !== WebSocket.OPEN) return;
  if (!sock.didAuth) {
    sock.ws.send(makeAuthString());
    sock.didAuth = true;
    return;
  }
  if (type === "register") sock.ws.send(makeRegisterString(`${pettNameBase}_${sock.id}`));
  else sock.ws.send(makeAuthString());
}

function blastWave() {
  const cfg = CONFIGS[type];
  const live = sockets.filter(s => s.ws.readyState === WebSocket.OPEN);
  if (!live.length) return (sendingStarted = blasting = false);

  blasting = true;
  waveCounter++;
  const interval = Math.max(1, Math.floor(cfg.BLAST_DURATION_MS / Math.max(1, cfg.REQUESTS_PER_SOCKET)));

  for (const sock of live) {
    for (let j = 0; j < cfg.REQUESTS_PER_SOCKET; j++) {
      setTimeout(() => {
        try { sendActionForSocket(sock); totalSent++; } catch {}
      }, j * interval);
    }
  }

  setTimeout(() => {
    blasting = false;
    setTimeout(blastWave, cfg.REST_BETWEEN_WAVES_MS);
  }, cfg.BLAST_DURATION_MS + 50);
}

function startSendingIfReady() {
  const cfg = CONFIGS[type];
  if (sendingStarted) return;
  if (sockets.length < cfg.TOTAL_SOCKETS) return;
  sendingStarted = true;
  console.log(`🚀 All ${cfg.TOTAL_SOCKETS} sockets connected — starting ${type.toUpperCase()} loop`);
  blastWave();
}

function connectSocket(socketId, attempt = 0) {
  const headers = {
    Origin: ORIGIN,
    "User-Agent": "Mozilla/5.0",
    // "X-Loadtest-Nonce": uniqueNonce(),
  };

  const ws = new WebSocket(ENDPOINT, { headers, perMessageDeflate: false, handshakeTimeout: CONNECT_TIMEOUT_MS });
  const sock = { ws, id: socketId, didAuth: false, attempts: attempt };
  sockets.push(sock);

  const reconnect = async (reason = {}) => {
    sockets = sockets.filter(s => s !== sock);
    try { ws.terminate(); } catch {}
    const delay = reason.is429 ? 3000 : 1000 + Math.random() * 1000;
    if (attempt < MAX_RECONNECT_ATTEMPTS) {
      console.log(`♻️ Reconnecting socket ${socketId} (reason=${reason.is429 ? "429" : "disconnect"})`);
      await sleep(delay);
      connectSocket(socketId, attempt + 1);
    }
  };

  let connectTimer = setTimeout(() => {
    if (ws.readyState !== WebSocket.OPEN) {
      console.log(`⏱ Socket ${socketId} connect timeout`);
      reconnect();
    }
  }, CONNECT_TIMEOUT_MS);

  ws.on("open", () => {
    clearTimeout(connectTimer);
    console.log(`✅ Socket ${socketId} connected (${sockets.length}/${CONFIGS[type].TOTAL_SOCKETS})`);
    startSendingIfReady();
  });

  ws.on("message", async (m) => {
    let msg;
    try { msg = JSON.parse(m.toString()); } catch { return; }
    console.log(msg)
    totalReceived++;
    const err = String(msg?.error || "").toLowerCase();
    if (err.includes("too many requests")) {
      console.log(`⚠️ Socket ${socketId} hit 429`);
      await reconnect({ is429: true });
    }
  });

  ws.on("close", async (code, reason) => {
    const reasonStr = String(reason || "").toLowerCase();
    if (code === 429 || reasonStr.includes("too many requests")) {
      await reconnect({ is429: true });
    } else {
      await reconnect();
    }
  });

  ws.on("error", async (err) => {
    const em = String(err?.message || "");
    if (em.includes("429")) await reconnect({ is429: true });
    else await reconnect();
  });
}

// boot sequence
console.log(`🔌 Opening ${CONFIGS[type].TOTAL_SOCKETS} sockets in ${type.toUpperCase()} mode...`);
for (let i = 0; i < CONFIGS[type].TOTAL_SOCKETS; i++) {
  const delay = i * STAGGER_MS + Math.floor(Math.random() * JITTER_MS);
  setTimeout(() => connectSocket(i + 1), delay);
}

// summary
setInterval(() => {
  const live = sockets.filter(s => s.ws.readyState === WebSocket.OPEN).length;
  console.log(`[summary] ${new Date().toISOString()} live=${live} totalSent=${totalSent} totalReceived=${totalReceived} waves=${waveCounter}`);
}, SUMMARY_MS);

process.on("SIGINT", () => {
  console.log("SIGINT — closing sockets");
  for (const s of sockets) try { s.ws.close(); } catch {}
  process.exit(0);
});
