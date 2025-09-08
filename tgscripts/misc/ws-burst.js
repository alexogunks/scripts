// mod-burst-tight-optimized.js
import WebSocket from "ws";
import { v4 as uuidv4 } from "uuid";

const endpoint = "wss://petbot-monorepo-websocket-333713154917.europe-west1.run.app/";
const jwt = "Bearer eyJhbGciOiJFUzI1NiIsInR5cCI6IkpXVCIsImtpZCI6IlU3bU9NMzBNZGJRY3RQMmdoWE4wU0dhTDFIWjNSUWVoZWxkZUNHNF9OaWsifQ.eyJzaWQiOiJjbWY5dTU3OGQwMTE2anIwYjc5cnAwazZ2IiwiaXNzIjoicHJpdnkuaW8iLCJpYXQiOjE3NTcyNTgxNzIsImF1ZCI6ImNtN2dldjVzNjAwdmJrMmxzajZlMWU5ZzciLCJzdWIiOiJkaWQ6cHJpdnk6Y21mOXU1NzlrMDExOGpyMGJ4b2tqZTRiZyIsImV4cCI6MTc1NzI2MTc3Mn0.DKdA8m0E4HJreJDVxJEne18HO52ayZ8Z5VkqqTY3ozcrJdP9uEGlUqcoVTlmrml0a5Jc1_UrdxpWhuAw6lJSTw";
const origin = "https://app.pett.ai";

// ---- CONFIG ----
const connectionCount = 12;     // <= 20 sockets (server limit)
const messagesPerSocket = 30;   // <= 30 msgs/socket (server limit)
const burstIntervalMs = 100;   // gap between bursts
const restartOnSocketFailure = true;

// ---- STATE ----
let sockets = [];
let totalSent = 0;
const name = "ao_" + Math.round(Math.random() * 100) + "n_n" + Math.floor(Math.random()*1000);

let burstStart = 0, acked = 0;
const pending = new Map();
const getNonce = (m) => m?.nonce || m?.data?.nonce || m?.payload?.nonce || m?.result?.nonce || m?.n;

// ---- messages ----
const authMsg = () => ({
  type: "AUTH",
  data: { params: { authType: "privy", authHash: { hash: jwt } } },
  nonce: uuidv4()
});
const regStr = () => {
  const nonce = uuidv4();
  pending.set(nonce, Date.now());
  return `{"type":"REGISTER","data":{"params":{"authType":"privy","registerHash":{"hash":"${jwt}","name":"${name}"}}},"nonce":"${nonce}"}`;
};

// ---- burst ----
let bursting = false;
function fireBurst() {
  if (bursting) return;
  bursting = true;

  const live = sockets.filter(s => s.ws.readyState === WebSocket.OPEN);
  if (!live.length) { console.log("No live sockets"); bursting = false; return; }

  burstStart = Date.now();
  acked = 0;
  let sent = 0;

  const perSocket = Math.min(messagesPerSocket, 30);
  const groupSize = 5;    // 5 msgs per flush
  const groupDelay = 2;   // 2ms between groups → ~12ms/socket

  for (const { ws } of live) {
    let queue = [];
    for (let j = 0; j < perSocket; j++) queue.push(regStr());

    const sendGroup = () => {
      if (!queue.length) return;
      try { ws._socket?.cork(); } catch {}
      for (let i = 0; i < groupSize && queue.length; i++) {
        try { ws.send(queue.shift(), { compress: false }); sent++; } catch {}
      }
      try { ws._socket?.uncork(); } catch {}
      if (queue.length) setTimeout(sendGroup, groupDelay);
    };

    sendGroup();
  }

  totalSent += sent;

  setTimeout(() => {
    console.log(
      `⚡ Burst: sent=${sent} · ACK=${acked} · sockets=${live.length} · totalSent=${totalSent}`
    );
    bursting = false;
    setTimeout(fireBurst, burstIntervalMs);
  }, 40); // allow wave to finish
}



// ---- sockets ----
function connect(socketId) {
  const ws = new WebSocket(endpoint, { headers: { Origin: origin }, perMessageDeflate: false });

  ws.on("open", () => {
    try { ws._socket?.setNoDelay(true); } catch {}
    ws.send(JSON.stringify(authMsg()), { compress: false });
  });

  ws.on("message", (buf) => {
    try {
      const msg = JSON.parse(buf.toString());
      const t = (msg.type || "").toLowerCase();
        console.log(msg)
      if (t === "auth_result") {
        sockets.push({ ws, id: socketId });
        if (sockets.length === connectionCount) {
          console.log("🚀 All sockets ready — starting bursts");
          fireBurst();
        }
        return;
      }

      const n = getNonce(msg);
      if (n && pending.has(n)) {
        const tSent = pending.get(n);
        pending.delete(n);
        const now = Date.now();
        if (tSent >= burstStart) acked++;
      }
    } catch {}
  });

  const bail = (label, e) => {
    console.error(`❌ Socket ${socketId} ${label}:`, e?.message || e || "");
    if (restartOnSocketFailure) process.exit(1);
  };
  ws.on("error", (e) => bail("error", e));
  ws.on("close", (c, r) => bail(`closed (${c})`, r));
}

// ---- boot ----
console.log(`🔌 Opening ${connectionCount} sockets…`);
for (let i = 0; i < connectionCount; i++) connect(i + 1);
