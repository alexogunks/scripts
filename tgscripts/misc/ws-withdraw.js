import WebSocket from "ws";
import { v4 as uuidv4 } from "uuid";

/** ====== ENV / CONSTANTS ====== */
const endpoint = "wss://petbot-monorepo-websocket-333713154917.europe-west1.run.app/";
const origin = "https://app.pett.ai";

/** ====== CONFIG ====== */
const CONNECT_STAGGER_MS = 75;       // ms between scheduling new connects
const CONNECT_TIMEOUT_MS = 15000;    // handshake deadline per socket
const MAX_CONNECT_RETRIES = 3;       // retries per socket
const MAX_CONCURRENT_CONNECTS = 30;  // simultaneous TCP/TLS handshakes

// Modes allowed
let type = "withdraw"; // "withdraw" | "jump"

/** ====== INPUT: MULTI-JWT + WITHDRAW IDS ====== */
const jwtGroups = [
  {
    jwt: "",
    withdrawals: [
      "11111111-aaaa-bbbb-cccc-111111111111",
      "22222222-aaaa-bbbb-cccc-222222222222",
    ],
  },
  {
    jwt: "",
    withdrawals: [
      "33333333-aaaa-bbbb-cccc-333333333333",
      "44444444-aaaa-bbbb-cccc-444444444444",
    ],
  },
];

/** ====== HELPERS ====== */
const sleep = (ms) => new Promise(r => setTimeout(r, ms));
const uniqueNonce = () => uuidv4();

function pickWithdrawalId(group) {
  const list = group.withdrawals;
  return list[Math.floor(Math.random() * list.length)];
}

/** ====== MESSAGE BUILDERS ====== */
const makeAuthString = (jwt) => JSON.stringify({
  type: "AUTH",
  data: { params: { authType: "privy", authHash: { hash: jwt } } },
  nonce: uniqueNonce(),
});

const makeWithdrawString = (id) => JSON.stringify({
  type: "WITHDRAWAL_USE",
  data: { params: { withdrawalId: id } },
  nonce: uniqueNonce(),
});

const makeJumpString = (id) => JSON.stringify({
  type: "WITHDRAWAL_JUMP",
  data: { params: { withdrawalId: id } },
  nonce: uniqueNonce(),
});

/** ====== CONFIGS ====== */
const CONFIGS = {
  withdraw: {
    TOTAL_SOCKETS: 20,
    REQUESTS_PER_SOCKET: 1,
    BLAST_DURATION_MS: 200,
    REST_BETWEEN_WAVES_MS: 1500,
  },
  jump: {
    TOTAL_SOCKETS: 20,
    REQUESTS_PER_SOCKET: 1,
    BLAST_DURATION_MS: 200,
    REST_BETWEEN_WAVES_MS: 1500,
  },
};

const NEEDS_AUTH_FIRST = new Set(["withdraw", "jump"]);

/** ====== GROUP RUNNER (per JWT) ====== */
function runGroup(group, accountIndex) {
  let sockets = [];
  let sendingStarted = false;
  let blasting = false;
  let waveCounter = 0;
  let totalSent = 0;
  let inFlightConnects = 0;

  const cfg = CONFIGS[type];

  /** action per socket */
  async function sendActionForSocket(sock) {
    if (sock.ws.readyState !== WebSocket.OPEN) return;

    if (NEEDS_AUTH_FIRST.has(type) && !sock.didAuth) {
      sock.ws.send(makeAuthString(group.jwt));
      sock.didAuth = true;
      await sleep(500); // short delay after AUTH
    }

    const withdrawalId = pickWithdrawalId(group);
    if (type === "withdraw") sock.ws.send(makeWithdrawString(withdrawalId));
    if (type === "jump") sock.ws.send(makeJumpString(withdrawalId));
  }

  /** blast loop */
  function blastWave() {
    const live = sockets.filter(s => s.ws.readyState === WebSocket.OPEN);
    if (!live.length) {
      console.log(`⚠ [Acc#${accountIndex}] No live sockets remain`);
      sendingStarted = false;
      blasting = false;
      return;
    }

    blasting = true;
    waveCounter++;
    let sentThisWave = 0;
    const interval = cfg.BLAST_DURATION_MS / cfg.REQUESTS_PER_SOCKET;

    for (const sock of live) {
      for (let j = 0; j < cfg.REQUESTS_PER_SOCKET; j++) {
        setTimeout(() => {
          sendActionForSocket(sock).then(() => {
            sentThisWave++;
          }).catch(() => {});
        }, j * interval);
      }
    }

    setTimeout(() => {
      totalSent += sentThisWave;
      console.log(
        `⚡ [Acc#${accountIndex}] Wave #${waveCounter}: sent=${sentThisWave} · live=${live.length} · totalSent=${totalSent}`
      );
      blasting = false;
      setTimeout(blastWave, cfg.REST_BETWEEN_WAVES_MS);
    }, cfg.BLAST_DURATION_MS + 20);
  }

  /** start sending when all sockets connected */
  function startSendingIfReady() {
    if (sendingStarted) return;
    if (sockets.length !== cfg.TOTAL_SOCKETS) return;
    sendingStarted = true;
    console.log(`🚀 [Acc#${accountIndex}] All sockets ready`);
    blastWave();
  }

  /** connect one socket */
  function connectSocketOnce(socketId) {
    return new Promise((resolve, reject) => {
      const headers = { Origin: origin, "User-Agent": "Mozilla/5.0" };
      const ws = new WebSocket(endpoint, { headers, perMessageDeflate: false });
      const sock = { ws, id: socketId, didAuth: false };

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
        sockets.push(sock);
        console.log(`✅ [Acc#${accountIndex}] Socket ${socketId} connected (${sockets.length}/${cfg.TOTAL_SOCKETS})`);
        ws.on("message", (m) => {
          try {
            const msg = JSON.parse(m.toString());
            if (msg.error) console.log(`⚠️ [Acc#${accountIndex}]`, msg.error);
          } catch {}
        });
        startSendingIfReady();
        resolve();
      });

      ws.on("close", () => {
        sockets = sockets.filter(s => s.id !== socketId);
      });

      ws.on("error", (err) => {
        if (!settled) {
          settled = true;
          clearTimeout(to);
          reject(err);
        }
      });
    });
  }

  async function connectSocketWithRetry(socketId, attempt = 1) {
    try {
      await connectSocketOnce(socketId);
    } catch (err) {
      if (attempt > MAX_CONNECT_RETRIES) {
        console.warn(`⚠️ [Acc#${accountIndex}] Socket ${socketId} failed: ${err?.message}`);
        return;
      }
      let backoff = 200 * Math.pow(2, attempt - 1);
      backoff = Math.floor(backoff * (0.75 + Math.random() * 0.5));
      console.warn(`↻ [Acc#${accountIndex}] Retry ${socketId} attempt ${attempt} in ${backoff}ms`);
      await sleep(backoff);
      return connectSocketWithRetry(socketId, attempt + 1);
    }
  }

  /** boot sockets */
  async function bootOpenSockets(target) {
    const ids = Array.from({ length: target }, (_, i) => i + 1);
    for (const id of ids) {
      while (inFlightConnects >= MAX_CONCURRENT_CONNECTS) {
        await sleep(10);
      }
      inFlightConnects++;
      await sleep(CONNECT_STAGGER_MS);
      connectSocketWithRetry(id)
        .finally(() => { inFlightConnects = Math.max(0, inFlightConnects - 1); });
    }
  }

  console.log(`🔌 [Acc#${accountIndex}] Opening ${cfg.TOTAL_SOCKETS} sockets (${type.toUpperCase()})...`);
  bootOpenSockets(cfg.TOTAL_SOCKETS).catch(err => {
    console.error(`❌ [Acc#${accountIndex}] bootOpenSockets fatal:`, err?.message || err);
  });
}

/** ====== BOOT ALL JWT GROUPS ====== */
jwtGroups.forEach((group, idx) => {
  setTimeout(() => runGroup(group, idx + 1), idx * 2000);
});
