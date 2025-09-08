// mod-burst-tight.js
import WebSocket from "ws";
import { v4 as uuidv4 } from "uuid";

const endpoint = "wss://petbot-monorepo-websocket-333713154917.europe-west1.run.app/";
const jwt = "Bearer eyJhbGciOiJFUzI1NiIsInR5cCI6IkpXVCIsImtpZCI6IlU3bU9NMzBNZGJRY3RQMmdoWE4wU0dhTDFIWjNSUWVoZWxkZUNHNF9OaWsifQ.eyJzaWQiOiJjbWY5ajI3Z2QwMTgxangwYmdiOW40cHVyIiwiaXNzIjoicHJpdnkuaW8iLCJpYXQiOjE3NTcyNTQ0MDgsImF1ZCI6ImNtN2dldjVzNjAwdmJrMmxzajZlMWU5ZzciLCJzdWIiOiJkaWQ6cHJpdnk6Y21mOWoyN2kyMDE4M2p4MGIyeTYxamVkYSIsImV4cCI6MTc1NzI1ODAwOH0.tHZLb4XmQbGNbeG8BpjGTM3djethgMnS2JEL42pGcSZ5WvYURO-7msDYaPGTG90PqhiUsoz13kiDgijOdotxpA";
const origin = "https://app.pett.ai";

const connectionCount = 20;     // sockets to open
const messagesPerSocket = 20;   // msgs per socket per burst
const burstWindowMs = 3;      // send all within this window
const burstIntervalMs = 2000;   // next burst scheduled after the window ends
const restartOnSocketFailure = true;

let sockets = [];
let totalSent = 0;
const name = "ao_" + Math.round(Math.random() * 100) + "n_n" + Math.floor(Math.random()*1000);

// ---- ACK accounting (by nonce, anywhere) ----
let burstStart = 0, deadline = 0, acked = 0;
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
  // prebuilt string (faster than stringify)
  return `{"type":"REGISTER","data":{"params":{"authType":"privy","registerHash":{"hash":"${jwt}","name":"${name}"}}},"nonce":"${nonce}"}`;
};

// ---- burst ----
let bursting = false;
function fireBurst() {
  if (bursting) return; // no overlap
  bursting = true;

  const live = sockets.filter(s => s.ws.readyState === WebSocket.OPEN);
  if (!live.length) { console.log("No live sockets"); bursting = false; return; }

  burstStart = Date.now(); deadline = burstStart + burstWindowMs; acked = 0;
  const quotas = live.map(() => messagesPerSocket);

  // cork all
  for (const { ws } of live) try { ws._socket?.cork(); } catch {}

  // interleave across sockets to feel "all at once"
  let sent = 0;
  outer: for (;;) {
    let any = false;
    for (let i = 0; i < live.length; i++) {
      if (Date.now() > deadline) break outer;
      if (quotas[i] <= 0) continue;
      const { ws } = live[i];
      if (ws.readyState !== WebSocket.OPEN) continue;
      try { ws.send(regStr(), { compress: false }); } catch {}
      quotas[i]--; sent++; any = true;
    }
    if (!any) break;
  }

  // uncork flush
  for (const { ws } of live) try { ws._socket?.uncork(); } catch {}

  totalSent += sent;

  setTimeout(() => {
    console.log(`⚡ Burst: sent≈${sent} · ACK=${acked} · window=${burstWindowMs}ms · totalSent=${totalSent}`);
    bursting = false;
    setTimeout(fireBurst, burstIntervalMs); // schedule next after window
  }, Math.max(0, deadline - Date.now()) + 25);
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
      // Count ACKs (by nonce) without spamming logs
      const n = getNonce(msg);
      if (n && pending.has(n)) {
        const tSent = pending.get(n); pending.delete(n);
        const now = Date.now();
        if (tSent >= burstStart && now <= deadline) acked++;
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
