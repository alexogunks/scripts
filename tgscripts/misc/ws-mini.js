// mod-burst.js
import WebSocket from "ws";
import { v4 as uuidv4 } from "uuid";

const endpoint = "wss://petbot-monorepo-websocket-333713154917.europe-west1.run.app/";
const jwt = "Bearer eyJhbGciOiJFUzI1NiIsInR5cCI6IkpXVCIsImtpZCI6IlU3bU9NMzBNZGJRY3RQMmdoWE4wU0dhTDFIWjNSUWVoZWxkZUNHNF9OaWsifQ.eyJzaWQiOiJjbWY5ajI3Z2QwMTgxangwYmdiOW40cHVyIiwiaXNzIjoicHJpdnkuaW8iLCJpYXQiOjE3NTcyNTA0NTksImF1ZCI6ImNtN2dldjVzNjAwdmJrMmxzajZlMWU5ZzciLCJzdWIiOiJkaWQ6cHJpdnk6Y21mOWoyN2kyMDE4M2p4MGIyeTYxamVkYSIsImV4cCI6MTc1NzI1NDA1OX0.M8zj3Al4R1RKfLJnqihQjq_XQyg9TFkEWI9ukrVHLeq7z0ZxbPcXsJr851QxCEXGT-08mxK4QA1zVFRIr2uu2Q";
const origin = "https://app.pett.ai";

const pettName = `ao_${Math.floor(Math.random() * 999)}_rrr_${Math.floor(Math.random() * 9999)}`;

const connectionCount = 10;          // sockets to open
const messagesPerSocket = 10;       // messages per socket per burst
const burstIntervalMs = 1;         // how often to fire bursts
const burstWindowMs = 500;            // hard cap window per burst (send within this)
const restartOnSocketFailure = true;  // exit on any socket error/close

let totalRequestsSent = 0;
let sockets = [];

// Build a REGISTER with a unique name per message (avoid server dedupe) + unique nonce
function makeMessage(socketId) {
  const nonce = uuidv4();
  return {
    type: "REGISTER",
    data: {
      params: {
        authType: "privy",
        registerHash: {
          hash: jwt,
          name: `${pettName}`
        }
      }
    },
    nonce
  };
}

// Interleaved "all at once" burst across all sockets, confined to burstWindowMs
function fireBurst() {
  const live = sockets.filter(({ ws }) => ws.readyState === WebSocket.OPEN);
  if (!live.length) {
    console.log("No live sockets");
    return;
  }

  // Each socket gets the same quota
  const quotas = live.map(() => messagesPerSocket);

  const start = Date.now();
  const deadline = start + burstWindowMs;

  // Cork all sockets to flush together at the end
  for (const { ws } of live) {
    try { ws._socket?.cork(); } catch {}
  }

  let burstCount = 0;

  outer: for (;;) {
    let any = false;
    for (let i = 0; i < live.length; i++) {
      if (Date.now() > deadline) break outer;
      if (quotas[i] <= 0) continue;

      const { ws, id } = live[i];
      if (ws.readyState !== WebSocket.OPEN) continue;

      const msg = makeMessage(id);
      try {
        ws.send(JSON.stringify(msg), { compress: false }); // skip compression for speed
        quotas[i]--;
        burstCount++;
      } catch (_) {
        // ignore; socket error handler will take care of restart if needed
      }
      any = true;
    }
    if (!any) break; // all quotas exhausted
  }

  // Uncork to flush all frames together
  for (const { ws } of live) {
    try { ws._socket?.uncork(); } catch {}
  }

  totalRequestsSent += burstCount;
  console.log(`⚡ Burst fired: ${burstCount} msgs in ~${Date.now() - start}ms (window=${burstWindowMs}ms)`);
  console.log(`📤 Total sent so far: ${totalRequestsSent}`);
}

function connect(socketId) {
  const ws = new WebSocket(endpoint, {
    headers: { Origin: origin },
    perMessageDeflate: false, // critical: avoid CPU/latency for tiny frames
  });

  ws.on("open", () => {
    try { ws._socket?.setNoDelay(true); } catch {}
    const authMessage = {
      type: "AUTH",
      data: { params: { authType: "privy", authHash: { hash: jwt } } },
      nonce: uuidv4()
    };
    ws.send(JSON.stringify(authMessage), { compress: false });
  });

  ws.on("message", (data) => {
    try {
      const msg = JSON.parse(data.toString());
      const t = (msg.type || "").toLowerCase();
      console.log(msg);
      msg?.pet && console.log(`Tokens = ${Math.round(Number(msg?.pet?.PetTokens?.tokens) / Number(1000000000000000000))}, Error = ${msg?.error}`);
      if (t === "auth_result") {
        sockets.push({ ws, id: socketId });
        if (sockets.length === connectionCount) {
          console.log("🚀 All sockets ready, starting synchronized bursts…");
          // First burst immediately, then every interval
          fireBurst();
          setInterval(fireBurst, burstIntervalMs);
        }
      } else {
        // Still track the socket even if auth_result type differs/omits success flag
        if (!sockets.find(s => s.ws === ws)) {
          sockets.push({ ws, id: socketId });
          if (sockets.length === connectionCount) {
            console.log("🚀 All sockets ready, starting synchronized bursts…");
            fireBurst();
            setInterval(fireBurst, burstIntervalMs);
          }
        }
      }
    } catch {
      // ignore parse errors
    }
  });

  const bail = (label, err) => {
    console.error(`❌ Socket ${socketId} ${label}:`, err?.message || err || "");
    if (restartOnSocketFailure) process.exit(1); // let your supervisor restart
  };

  ws.on("close", (code, reason) => bail(`closed (${code})`, reason));
  ws.on("error", (err) => bail("error", err));
}

console.log(`🔌 Opening ${connectionCount} sockets…`);
for (let i = 0; i < connectionCount; i++) connect(i + 1);
