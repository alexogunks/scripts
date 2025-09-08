// burst-1800.js
import WebSocket from "ws";
import { v4 as uuidv4 } from "uuid";

const endpoint = "wss://petbot-monorepo-websocket-333713154917.europe-west1.run.app/";
const jwt = "Bearer eyJhbGciOiJFUzI1NiIsInR5cCI6IkpXVCIsImtpZCI6IlU3bU9NMzBNZGJRY3RQMmdoWE4wU0dhTDFIWjNSUWVoZWxkZUNHNF9OaWsifQ.eyJzaWQiOiJjbWY5eXEzbGIwMHg3bDgwYjlwOWEwZXB0IiwiaXNzIjoicHJpdnkuaW8iLCJpYXQiOjE3NTcyNjU4NjUsImF1ZCI6ImNtN2dldjVzNjAwdmJrMmxzajZlMWU5ZzciLCJzdWIiOiJkaWQ6cHJpdnk6Y21mOXlxM21zMDB4OWw4MGIxaG1lMGlkYyIsImV4cCI6MTc1NzI2OTQ2NX0.3-gyJ00HWm7MXts_xvwnuGX3_onAPaNJUVAOvwbIm1XpnpzWReY5SrH9u2wknxVGrftWspFPogoSXaK4eCGFkQ";
const origin = "https://app.pett.ai";

// ---- CONFIG ----
const connectionCount = 500;     // stable sweet spot you found
const messagesPerSocket = 2500;   // <= 30 msgs/socket
const burstIntervalMs = 550;     // ~18 bursts/sec → 1800 msgs/sec
const restartOnSocketFailure = false;

// ---- STATE ----
let sockets = [];
let totalSent = 0;
let burstCounter = 0;
const name = "ao_" + Math.round(Math.random() * 100) + "n_n" + Math.floor(Math.random() * 1000);

let acked = 0;
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

// ---- bursts ----
let bursting = false;
function fireBurst() {
  if (bursting) return;
  bursting = true;

  const live = sockets.filter(s => s.ws.readyState === WebSocket.OPEN);
  if (!live.length) { console.log("No live sockets"); bursting = false; return; }

  acked = 0;
  let sent = 0;

  for (const { ws } of live) {
    try { ws._socket?.cork(); } catch {}
    for (let j = 0; j < Math.min(messagesPerSocket, 30); j++) {
      try { ws.send(regStr(), { compress: false }); sent++; } catch {}
    }
    try { ws._socket?.uncork(); } catch {}
  }

  totalSent += sent;
  burstCounter++;

  console.log(`⚡ Burst #${burstCounter}: sent=${sent} · ACK=${acked} · sockets=${live.length} · totalSent=${totalSent}`);

  bursting = false;
  setTimeout(fireBurst, burstIntervalMs);
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
      console.log(msg);
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
        pending.delete(n);
        acked++;
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
