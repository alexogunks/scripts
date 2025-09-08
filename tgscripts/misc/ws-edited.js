// smooth-blast-sockets.js
import WebSocket from "ws";
import { v4 as uuidv4 } from "uuid";

const endpoint = "wss://petbot-monorepo-websocket-333713154917.europe-west1.run.app/";
const origin = "https://app.pett.ai";
const pettName = `ao_${Math.floor(Math.random() * 999)}_rrr_${Math.floor(Math.random() * 999)}`;

const jwt = "Bearer eyJhbGciOiJFUzI1NiIsInR5cCI6IkpXVCIsImtpZCI6IlU3bU9NMzBNZGJRY3RQMmdoWE4wU0dhTDFIWjNSUWVoZWxkZUNHNF9OaWsifQ.eyJzaWQiOiJjbWZhazBqZjYwMWpqbDUwY25lZGxvcWNnIiwiaXNzIjoicHJpdnkuaW8iLCJpYXQiOjE3NTczMDE2MjQsImF1ZCI6ImNtN2dldjVzNjAwdmJrMmxzajZlMWU5ZzciLCJzdWIiOiJkaWQ6cHJpdnk6Y21mYWswamdqMDFqbGw1MGNvMzVlcHdlNSIsImV4cCI6MTc1NzMwNTIyNH0.F7RAvtliroAtvnwFF2EXEGPpxpIaAyshfFEzOjgt3AITjgd20X5qHR6xa8rwVdJDNBjuBhjpoCCmqhxe00h6gQ"; // your token

// ---- CONFIG ----
const TOTAL_SOCKETS = 250;        // target pool size
const REQUESTS_PER_SOCKET = 25;   // how many per socket per wave
const BLAST_DURATION_MS = 40;   // spread requests across this window
const REST_BETWEEN_WAVES_MS = 55; // wait before next cycle

// ---- STATE ----
let sockets = [];
let totalSent = 0;
let waveCounter = 0;
let blasting = false;

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

// ---- send gradually ----
function blastWave() {
  const live = sockets.filter((s) => s.ws.readyState === WebSocket.OPEN);
  if (!live.length) {
    console.log("⚠ No live sockets remain, stopping");
    return;
  }

  blasting = true;
  waveCounter++;
  let sent = 0;

  const interval = BLAST_DURATION_MS / REQUESTS_PER_SOCKET;

  for (const { ws } of live) {
    for (let j = 0; j < REQUESTS_PER_SOCKET; j++) {
      setTimeout(() => {
        try {
          ws.send(makeRegisterString(), { compress: false });
          sent++;
        } catch {}
      }, j * interval);
    }
  }

  // finish after the whole window
  setTimeout(() => {
    totalSent += sent;
    console.log(
      `⚡ Wave #${waveCounter}: sent=${sent} · liveSockets=${live.length} · totalSent=${totalSent}`
    );
    blasting = false;
    setTimeout(blastWave, REST_BETWEEN_WAVES_MS);
  }, BLAST_DURATION_MS + 20);
}


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

    // Start waves as soon as the initial pool is ready
    if (sockets.length === TOTAL_SOCKETS && !blasting) {
      console.log("🚀 All sockets ready — starting waves");
      blastWave();
    }
  });

  ws.on("message", (m) => {
    const msg = JSON.parse(m.toString())
    console.log(msg);
  });

  ws.on("close", () => {
    console.log(`🔒 Socket ${socketId} closed`);
    sockets = sockets.filter((s) => s.id !== socketId);
    // no reconnect — continue with remaining sockets
  });

  ws.on("error", (err) => {
    console.error(`❌ Socket ${socketId} error:`, err.message);
  });
}

// ---- boot ----
console.log(`🔌 Opening ${TOTAL_SOCKETS} sockets…`);
for (let i = 0; i < TOTAL_SOCKETS; i++) connectSocket(i + 1);
