// burst-sockets.js
import WebSocket from "ws";
import { v4 as uuidv4 } from "uuid";

const endpoint = "wss://petbot-monorepo-websocket-333713154917.europe-west1.run.app/";
const origin = "https://app.pett.ai";
const pettName = `ao_${Math.floor(Math.random() * 999)}_rrr_${Math.floor(Math.random() * 9999)}`;

const jwt = "Bearer eyJhbGciOiJFUzI1NiIsInR5cCI6IkpXVCIsImtpZCI6IlU3bU9NMzBNZGJRY3RQMmdoWE4wU0dhTDFIWjNSUWVoZWxkZUNHNF9OaWsifQ.eyJzaWQiOiJjbWZhMHNqa3EwMGFrbDEwZGlpNjc5aG94IiwiaXNzIjoicHJpdnkuaW8iLCJpYXQiOjE3NTcyNjkzMzgsImF1ZCI6ImNtN2dldjVzNjAwdmJrMmxzajZlMWU5ZzciLCJzdWIiOiJkaWQ6cHJpdnk6Y21mYTBzam1mMDBhbWwxMGRjMWUwamFzdiIsImV4cCI6MTc1NzI3MjkzOH0.TzWvntx9TxSEpR5CirbscwU8l2alq-OuL7rMCrK64KkkbqBQUbdj7NMRjCe8nj9qDgOUObUUwQV4JFgGtlVFjQ"; // your token

// ---- CONFIG ----
const TOTAL_SOCKETS = 250;      // target pool size
const REQUESTS_PER_SOCKET = 10; // <= 30 msgs/socket (server limit)
const BURST_INTERVAL_MS = 55;  // time between bursts
const restartOnSocketFailure = false; // don't reconnect, just drop dead ones

// ---- STATE ----
let sockets = [];
let totalSent = 0;
let burstCounter = 0;
let burstsStarted = false;

// ---- messages ----
function makeRegisterString() {
  return JSON.stringify({
    type: "REGISTER",
    data: {
      params: {
        authType: "privy",
        registerHash: { hash: jwt, name: pettName },
      },
    },
    nonce: uuidv4(),
  });
}

// ---- bursts ----
function fireBurst() {
  const live = sockets.filter((s) => s.ws.readyState === WebSocket.OPEN);
  if (!live.length) {
    console.log("⚠ No live sockets remain, stopping bursts");
    clearInterval(burstTimer);
    return;
  }

  let sent = 0;
  for (const { ws } of live) {
    try {
      ws._socket?.cork();
      for (let j = 0; j < REQUESTS_PER_SOCKET; j++) {
        try {
          ws.send(makeRegisterString(), { compress: false });
          sent++;
        } catch {}
      }
      ws._socket?.uncork();
    } catch {}
  }

  totalSent += sent;
  burstCounter++;
  console.log(
    `⚡ Burst #${burstCounter}: sent=${sent} · liveSockets=${live.length} · totalSent=${totalSent}`
  );
}

let burstTimer = null;

// ---- sockets ----
function connectSocket(socketId) {
  const headers = {
    Origin: origin,
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64)",
  };

  const ws = new WebSocket(endpoint, { headers, perMessageDeflate: false });

  ws.on("open", () => {
    sockets.push({ ws, id: socketId });
    console.log(`✅ Socket ${socketId} connected (${sockets.length}/${TOTAL_SOCKETS})`);

    // When the initial pool is ready, start bursts ONCE
    if (!burstsStarted && sockets.length === TOTAL_SOCKETS) {
      console.log("🚀 Initial pool ready — starting bursts");
      burstsStarted = true;
      burstTimer = setInterval(fireBurst, BURST_INTERVAL_MS);
    }
  });

  ws.on("close", () => {
    console.log(`🔒 Socket ${socketId} closed`);
    sockets = sockets.filter((s) => s.id !== socketId);
    // We do NOT reconnect, just continue with remaining sockets
  });

  ws.on("error", (err) => {
    console.error(`❌ Socket ${socketId} error:`, err.message);
  });
}

// ---- boot ----
console.log(`🔌 Opening ${TOTAL_SOCKETS} sockets…`);
for (let i = 0; i < TOTAL_SOCKETS; i++) connectSocket(i + 1);
