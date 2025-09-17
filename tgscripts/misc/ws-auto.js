import WebSocket from "ws";
import { v4 as uuidv4 } from "uuid";

/** ====== ENV / CONSTANTS ====== */
const endpoint = "wss://petbot-monorepo-websocket-333713154917.europe-west1.run.app/";
const origin = "https://app.pett.ai";
// const pettName = `ao_nb_${Math.floor(Math.random() * 999)}_rn_${Math.floor(Math.random() * 999)}`;
const pettName = `discarded_${Math.floor(Math.random() * 999999)}_t1`;
// const pettName = `t.a_banker_${Math.floor(Math.random() * 999)}`;
const jwt = "Bearer eyJhbGciOiJFUzI1NiIsInR5cCI6IkpXVCIsImtpZCI6IlU3bU9NMzBNZGJRY3RQMmdoWE4wU0dhTDFIWjNSUWVoZWxkZUNHNF9OaWsifQ.eyJzaWQiOiJjbWZoY2dhdXkwMDVoanUwYXkwMnc4YmV5IiwiaXNzIjoicHJpdnkuaW8iLCJpYXQiOjE3NTgxNDc1NjAsImF1ZCI6ImNtN2dldjVzNjAwdmJrMmxzajZlMWU5ZzciLCJzdWIiOiJkaWQ6cHJpdnk6Y21lbnNmaGFlMDA2ZGw5MGNrdjU2cmtyYSIsImV4cCI6MTc1ODE1MTE2MH0.DAOse-qOf453YQMOLJHe_LSds5yjBoQqiVowwPYhXPPmbnRbA-E2D864agiaoc6sao6cd1TyIh_c1N_guPChcw"

/** start type */
let type = "jump"; // "register" | "withdraw" | "food" | "atm" | "dice" | "jump" | "door"

const useAtm = false;

/** helper: 1..10 sockets for food/atm */
// const rand1to10 = () => Math.floor(Math.random() * 10) + 1;
const rand1to10 = () => 10;

// Sleep helper 
function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// Nonce helper
function uniqueNonce() {
  return uuidv4();
}

/** withdrawal pool (for withdraw / jump) */
const withdrawalIds = [
  // "7a9f5230-4264-4971-951c-90cc40a0efe2",
  "f5f13320-3c17-4ac2-926a-7533efee7c9f"
];

const pickWithdrawalId = () =>
  withdrawalIds[Math.floor(Math.random() * withdrawalIds.length)];

/** ====== MESSAGE BUILDERS ====== */
const makeRegisterString = () =>
  JSON.stringify({
    type: "REGISTER",
    data: { params: { authType: "privy", registerHash: { hash: jwt, name: pettName } } },
    nonce: uniqueNonce(),
  });

const makeAuthString = () =>
  JSON.stringify({
    type: "AUTH",
    data: { params: { authType: "privy", authHash: { hash: jwt } } },
    nonce: uniqueNonce(),
  });

const makeWithdrawString = (withdrawalId) =>
  JSON.stringify({
    type: "WITHDRAWAL_USE",
    data: { params: { withdrawalId } },
    nonce: uniqueNonce(),
  });

const makeJumpString = (withdrawalId) =>
  JSON.stringify({
    type: "WITHDRAWAL_JUMP",
    data: { params: { withdrawalId } },
    nonce: uniqueNonce(),
  });

const makeDoorString = () =>
  JSON.stringify({
    type: "PLAY_DOORS",
    data: {},
    nonce: uniqueNonce(),
  });

const makeBuyString = () =>
  JSON.stringify({
    type: "CONSUMABLES_BUY",
  data: { params: { foodId: "ENERGIZER", amount: 1 + Math.random() * 0.01 } },
    nonce: uniqueNonce(),
  });

// const makeBuyString = () =>
//   JSON.stringify({
//     type: "CONSUMABLES_BUY",
//     data: { params: { foodId: "POTION", amount: 1 + Math.random() * 0.01 } },
//     nonce: uniqueNonce(),
//   });

const makeAtmString = () => {
  let amountToSend = Number(Math.floor(tokenBalance - Number(tokenBalance * 10 / 100)));
  return JSON.stringify({
    type: "TRANSFER",
    data: {
        params: {
            petTo: "23d430f9-e9f8-4788-a1a3-97c9476dad28",
            // amount: 0
            amount: Math.round(Number(amountToSend - Number(amountToSend * 0.1 / 100)))
        }
    },
    nonce: uniqueNonce()
  });
}

/** dice helpers (if you use dice) */
const chooseDiceBet = (mode = "number") => {
  if (mode === "number") {
    if (Math.random() < 0.7) return Math.random() < 0.5 ? 3 : 4;
    return Math.floor(Math.random() * 6) + 1;
  }
  return mode.toUpperCase() === "EVEN" ? "EVEN" : "ODD";
};
const makeDiceString = (betAmount, mode) =>
  JSON.stringify({
    type: "PLAY_DICE",
    data: {
      params: {
        betAmount,
        selectedBet: { number: chooseDiceBet(mode), type: "number" },
      },
    },
    nonce: uniqueNonce(),
  });

/** ====== CONFIGS ====== */
const CONFIGS = {
  register: {
    TOTAL_SOCKETS: 25,
    REQUESTS_PER_SOCKET: 1500,
    BLAST_DURATION_MS: 1000,
    REST_BETWEEN_WAVES_MS: 30000,
  },
  withdraw: {
    TOTAL_SOCKETS: 10,
    REQUESTS_PER_SOCKET: 1,
    BLAST_DURATION_MS: 40,
    REST_BETWEEN_WAVES_MS: 1000,
  },
  food: {
    TOTAL_SOCKETS: rand1to10(),
    REQUESTS_PER_SOCKET: 5,
    BLAST_DURATION_MS: 40,
    REST_BETWEEN_WAVES_MS: 1000,
  },
  atm: {
    TOTAL_SOCKETS: 3,
    REQUESTS_PER_SOCKET: 1, // not used by the atm interval; kept for symmetry
    BLAST_DURATION_MS: 40,
    REST_BETWEEN_WAVES_MS: 2000,
  },
  door: {
    TOTAL_SOCKETS: 10,
    REQUESTS_PER_SOCKET: 20,
    BLAST_DURATION_MS: 40,
    REST_BETWEEN_WAVES_MS: 500,
  },
  dice: {
    TOTAL_SOCKETS: 10,
    REQUESTS_PER_SOCKET: 20,
    BLAST_DURATION_MS: 40,
    REST_BETWEEN_WAVES_MS: 500,
  },
  jump: {
    TOTAL_SOCKETS: 3,
    REQUESTS_PER_SOCKET: 20,
    BLAST_DURATION_MS: 40,
    REST_BETWEEN_WAVES_MS: 500,
  },
};

const NEEDS_AUTH_FIRST = new Set(["withdraw", "food", "atm", "dice", "door", "jump"]);

/** ====== STATE ====== */
let sockets = []; // [{ ws, id, didAuth, withdrawalId }]
let totalSent = 0;
let totalReceived = 0; // "user already created" counter
let waveCounter = 0;
let blasting = false;
let sendingStarted = false;

let currentLevel = 0;
let levelAim = 10;
let tokenBalance = 0;

let pendingOpenType = null;

let blastTimer = null;
let restTimer = null;
let atmInterval = null;

/** ====== ACTION SENDER (per socket, respects auth-once) ====== */
function sendActionForSocket(sock) {
  if (sock.ws.readyState !== WebSocket.OPEN) return;

  // Ensure AUTH first if required
  if (NEEDS_AUTH_FIRST.has(type) && !sock.didAuth) {
    sock.ws.send(makeAuthString());
    sock.didAuth = true;
  }

  // Then send the action
  switch (type) {
    case "register":
      sock.ws.send(makeRegisterString());
      break;
    case "withdraw":
      sock.ws.send(makeWithdrawString(sock.withdrawalId ?? (sock.withdrawalId = pickWithdrawalId())));
      break;
    case "food":
      sock.ws.send(makeBuyString());
      break;
    case "atm":
      sock.ws.send(makeAtmString());
      break;
    case "door":
      sock.ws.send(makeDoorString());
      break;
    case "dice":
      sock.ws.send(makeDiceString(5000, "number"));
      break;
    case "jump":
      sock.ws.send(makeJumpString(sock.withdrawalId ?? (sock.withdrawalId = pickWithdrawalId())));
      break;
    default:
      break;
  }
}

/** ====== BLAST LOOP (non-ATM modes) ====== */
function blastWave() {
  if (type === "atm") return;

  const cfg = CONFIGS[type];
  const live = sockets.filter((s) => s.ws.readyState === WebSocket.OPEN);
  if (!live.length) {
    console.log("⚠ No live sockets remain, stopping waves");
    sendingStarted = false;
    blasting = false;
    return;
  }

  blasting = true;
  waveCounter++;
  let sentThisWave = 0;
  const interval = cfg.BLAST_DURATION_MS / cfg.REQUESTS_PER_SOCKET;

  // schedule sends
  for (const sock of live) {
    for (let j = 0; j < cfg.REQUESTS_PER_SOCKET; j++) {
      setTimeout(() => {
        try {
          sendActionForSocket(sock);
          sentThisWave++;
        } catch {}
      }, j * interval);
    }
  }

  blastTimer = setTimeout(() => {
    totalSent += sentThisWave;
    console.log(
      `⚡ Wave #${waveCounter}: sent=${sentThisWave} · liveSockets=${live.length} · totalSent=${totalSent}`
    );
    blasting = false;
    restTimer = setTimeout(blastWave, cfg.REST_BETWEEN_WAVES_MS);
  }, cfg.BLAST_DURATION_MS + 20);
}

/** ====== ATM LOOP ====== */
function startAtmLoop() {
  clearAtmLoop();
  const cfg = CONFIGS.atm;
  atmInterval = setInterval(() => {
    const live = sockets.filter((s) => s.ws.readyState === WebSocket.OPEN);
    if (!live.length) return;
    if (!useAtm) return console.log("🏧 No ATM!");
    for (const sock of live) sendActionForSocket(sock);
    console.log("🏧 ATM tick sent across live sockets");
  }, cfg.REST_BETWEEN_WAVES_MS);
}
function clearAtmLoop() {
  if (atmInterval) {
    clearInterval(atmInterval);
    atmInterval = null;
  }
}

/** ====== START SENDING LATCH ====== */
function startSendingIfReady() {
  const cfg = CONFIGS[type];
  if (sendingStarted) return;
  if (sockets.length !== cfg.TOTAL_SOCKETS) return;

  sendingStarted = true;
  console.log(`🚀 All ${cfg.TOTAL_SOCKETS} sockets connected — starting ${type.toUpperCase()} loop`);
  if (type === "atm") startAtmLoop();
  else blastWave();
}

/** ====== SWITCH TYPE (close all, then reopen new type) ====== */
function switchType(newType) {
  if (type === newType) return;
  console.log(`🔄 Switching type: ${type} → ${newType}`);

  // stop loops/timers
  if (blastTimer) clearTimeout(blastTimer);
  if (restTimer) clearTimeout(restTimer);
  clearAtmLoop();
  blasting = false;
  sendingStarted = false;

  pendingOpenType = newType;

  for (const s of sockets) {
    try {
      s.ws.close();
    } catch {}
  }
}

/** ====== OPEN NEW TYPE AFTER ALL CLOSED ====== */
function openPendingTypeIfAny() {
  if (!pendingOpenType) return;
  if (sockets.length !== 0) return;

  type = pendingOpenType;
  pendingOpenType = null;

  if (type === "food") {
    CONFIGS[type].TOTAL_SOCKETS = rand1to10();
  }

  console.log(`🔌 Opening ${CONFIGS[type].TOTAL_SOCKETS} sockets in ${type.toUpperCase()} mode...`);
  for (let i = 0; i < CONFIGS[type].TOTAL_SOCKETS; i++) {
    setTimeout(() => connectSocket(i + 1), i * 100);
  }
}

/** ====== SOCKET HANDLING ====== */
function connectSocket(socketId) {
  const headers = {
    Origin: origin,
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64)",
  };
  const ws = new WebSocket(endpoint, { headers, perMessageDeflate: false });

  const sock = { ws, id: socketId, didAuth: false, withdrawalId: undefined };

  ws.on("open", () => {
    sockets.push(sock);
    console.log(`✅ Socket ${socketId} connected (${sockets.length}/${CONFIGS[type].TOTAL_SOCKETS})`);
    // DO NOT SEND HERE — wait until all sockets connected:
    startSendingIfReady();
  });

  ws.on("open", () => {
    ws.isAlive = true;
    ws.ping();
    setInterval(() => {
      if (ws.readyState === WebSocket.OPEN) ws.ping();
    }, 30000);
  });

  ws.on("message", async (m) => {
    let msg;
    try {
      msg = JSON.parse(m.toString());
    } catch {
      console.log("📩 (non-JSON message)", m.toString());
      return;
    }

    // debug
    const lower = msg?.error?.toLowerCase()
    if (lower !== 'too many requests. please wait to try again.') {
      if (lower) console.log(JSON.stringify(msg?.error));
    };

    // Level tracking
    if (msg?.pet?.PetStats?.level != null) {
      currentLevel = Number(msg.pet.PetStats.level);
      console.log(`📊 Current level: ${currentLevel}`);
      if (currentLevel >= levelAim && type !== "atm" && useAtm === true) {
        console.log(`🏁 Level ≥ ${levelAim} — switching to ATM`);
        switchType("atm");
      }
    }

    // Token balance
    if (msg?.pet?.PetTokens?.tokens != null) {
        tokenBalance = Number(msg.pet.PetTokens.tokens);
        const tokenBalanceDisplay = Math.floor(Number(tokenBalance / 1000000000000000000))
        console.log(`💰 Token balance: ${tokenBalanceDisplay}`);
        // console.log(`---${Number(Math.floor(tokenBalance - Number(tokenBalance * 0.1 / 100))/1000000000000000000)}`)
      }

    // Count CM messages (your prior signal)
    if (typeof msg.error == "string" && msg.error.toLowerCase() == "user already created") {
      totalReceived += 1;
      console.log("Total cm Received=" + totalReceived);
      if (totalReceived > 1 && type !== "food" && type !== "atm") {
        console.log(" Wait 3s for backend");
        await sleep(3000);
        console.log("🍗 CM > 1 — switching to FOOD");
        switchType("food");
      }
    }
  });

  ws.on("close", () => {
    console.log(`🔒 Socket ${socketId} closed`);
    sockets = sockets.filter((s) => s.id !== socketId);
    // When all are closed and we asked to switch, open the new type
    if (sockets.length === 0) {
      openPendingTypeIfAny();
    }
  });

  ws.on("error", (err) => {
    console.error(`❌ Socket ${socketId} error:`, err?.message || err);
  });
}

/** ====== BOOT ====== */
console.log(`🔌 Opening ${CONFIGS[type].TOTAL_SOCKETS} sockets in ${type.toUpperCase()} mode...`);
for (let i = 0; i < CONFIGS[type].TOTAL_SOCKETS; i++) connectSocket(i + 1);