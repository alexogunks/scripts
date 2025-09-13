import WebSocket from "ws";
import { v4 as uuidv4 } from "uuid";

const endpoint = "wss://petbot-monorepo-websocket-333713154917.europe-west1.run.app/";
const origin = "https://app.pett.ai";
const pettName = `ao_cb_${Math.floor(Math.random() * 999)}_rs_${Math.floor(Math.random() * 999)}`;

const jwt = "Bearer eyJhbGciOiJFUzI1NiIsInR5cCI6IkpXVCIsImtpZCI6IlU3bU9NMzBNZGJRY3RQMmdoWE4wU0dhTDFIWjNSUWVoZWxkZUNHNF9OaWsifQ.eyJzaWQiOiJjbWZoZjc3NTcwMDEwanMwY3ZzN2FqYjdwIiwiaXNzIjoicHJpdnkuaW8iLCJpYXQiOjE3NTc3MTY4MDAsImF1ZCI6ImNtN2dldjVzNjAwdmJrMmxzajZlMWU5ZzciLCJzdWIiOiJkaWQ6cHJpdnk6Y21maGY3Nzc5MDAxMmpzMGMxcTJneTc1eSIsImV4cCI6MTc1NzcyMDQwMH0.LMR11LX6eUOCjVLLZ3DMdT5ekYxBFZcMl0fLMNHg9sWBT1ckI3eX3I5yhrwhnTs3nm-N8uFEbyayyoQXaIkS8g"

// ---- CONFIG ----
const type = 'food';
const DICE_MODE = "number"; // "number" | "even" | "odd"
const betAmount = 5000;
const TOTAL_SOCKETS = type != 'jump' ? 10 : 1;
const REQUESTS_PER_SOCKET = type != 'jump' ? 20 : 1;
const BLAST_DURATION_MS = 40;
const REST_BETWEEN_WAVES_MS = type != 'jump' ? 500 : 500;

const withdrawalId = "fad13d11-6f9a-413a-bb73-89d6b9ef19db";

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
  });
}

function makeWithdrawString() {
  return JSON.stringify({
    type: "WITHDRAWAL_USE",
    data: { params: { withdrawalId } },
    nonce: uuidv4()
  });
}

function makeDoorString() {
  return JSON.stringify({
    type: "PLAY_DOORS",
    data: {},
    nonce: uuidv4()
  });
}

function makeBuyString() {
  return JSON.stringify({
    type: "CONSUMABLES_BUY",
    data: {
        params: {
            foodId: "ENERGIZER",
            amount: 1
        }
    },
    nonce: uuidv4()
})
}

// ---- Dice Betting Logic ----
function chooseDiceBet(mode = "number") {
  if (mode === "number") {
    if (Math.random() < 0.7) {
      return Math.random() < 0.5 ? 3 : 4;
    } else {
      return Math.floor(Math.random() * 6) + 1;
    }
  } else if (mode === "even") {
    return "EVEN";
  } else if (mode === "odd") {
    return "ODD";
  }
}

function makeDiceString(mode = DICE_MODE) {
  const choice = chooseDiceBet(mode);
  return JSON.stringify({
    type: "PLAY_DICE",
    data: {
        params: {
            betAmount,
            selectedBet: {
                number: choice,
                type: "number"
            }
        }
    },
    nonce: uuidv4()
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
        const t = type.toLowerCase();
        try {
            t !== 'register' && ws.send(makeAuthString());
            ws.send(
                t === 'register' ? makeRegisterString()
                : t === 'jump' ? makeJumpString()
                : t === 'door' ? makeDoorString()
                : t === 'dice' ? makeDiceString(DICE_MODE)
                : t === 'withdraw' ? makeWithdrawString()
                : t === 'food' && makeBuyString(),
                { compress: false }
            );
            sent++;
        } catch {}
      }, j * interval);
    }
  }

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

    if (sockets.length === TOTAL_SOCKETS && !blasting) {
      console.log("🚀 All sockets ready — starting waves");
      blastWave();
    }
  });

  ws.on("message", (m) => {
    const msg = JSON.parse(m.toString());
    console.log(msg);
    if (msg.error?.toLowerCase() === 'user already created') {
      totalReceived += 1;
    }
    console.log('Total cm Received=' + totalReceived);
  });

  ws.on("close", () => {
    console.log(`🔒 Socket ${socketId} closed`);
    sockets = sockets.filter((s) => s.id !== socketId);
  });

  ws.on("error", (err) => {
    console.error(`❌ Socket ${socketId} error:`, err.message);
  });
}

// ---- boot ----
console.log(`🔌 Opening ${TOTAL_SOCKETS} sockets…`);
for (let i = 0; i < TOTAL_SOCKETS; i++) connectSocket(i + 1);
