import WebSocket from "ws";
import { v4 as uuidv4 } from "uuid";

/** ====== ENV / CONSTANTS ====== */
const endpoint = "wss://petbot-monorepo-websocket-333713154917.europe-west1.run.app/";
const origin = "https://app.pett.ai";

// Modes allowed
let type = "jump"; // "withdraw" | "jump"

/** ====== CONFIG ====== */
const CONNECT_STAGGER_MS = 50;       // ms between scheduling new connects
const CONNECT_TIMEOUT_MS = 15000;    // handshake deadline per socket
const MAX_CONNECT_RETRIES = 3;       // retries per socket
const MAX_CONCURRENT_CONNECTS = 50;  // simultaneous

// Full vs Used sockets
const TOTAL_SOCKETS = 300; // actually connect this many
const ACTIVE_LIMIT = 10;  // but only *use* this many once connected

/** ====== INPUT: MULTI-JWT + WITHDRAW IDS ====== */
const jwtGroups = [
  {
    jwt: "Bearer eyJhbGciOiJFUzI1NiIsInR5cCI6IkpXVCIsImtpZCI6IlU3bU9NMzBNZGJRY3RQMmdoWE4wU0dhTDFIWjNSUWVoZWxkZUNHNF9OaWsifQ.eyJzaWQiOiJjbWZyaDJ3bWkwMDFubDIwZGFvc2YxYzFwIiwiaXNzIjoicHJpdnkuaW8iLCJpYXQiOjE3NTgzNzg2MDMsImF1ZCI6ImNtN2dldjVzNjAwdmJrMmxzajZlMWU5ZzciLCJzdWIiOiJkaWQ6cHJpdnk6Y21lMGx0N25mMDA5MWpsMGJ6b2tybDB4aiIsImV4cCI6MTc1ODM4MjIwM30.r114MMpbgD9wQ8ah_SEytEruRxNM1gTBfxX0sw3DH9TbbEZ_ZHs0-84LwMJgTPQUKJR4YhG3yMaZd5CmgtWcLw",
    withdrawals: [
      // Temzzz
      // "a695553b-3bfa-410f-af92-7e33c8fc63b8",
      // "8770cdf3-f169-403e-82c2-83348404596c",
      // Muhdbel
      // "f5f13320-3c17-4ac2-926a-7533efee7c9f",
      // Mehhnn
      // "1eda5ba4-25f7-454b-bbc4-2883f9b644ad",
      // "9ca1c302-6317-4ca9-9dce-4db2d44e9d2a",
      // 
      "d6850e00-29a7-4499-9cab-01e73f72235c",
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

const NEEDS_AUTH_FIRST = new Set(["withdraw", "jump"]);

/** ====== GROUP RUNNER (per JWT) ====== */
function runGroup(group, accountIndex) {
  let sockets = [];
  let sendingStarted = false;
  let blasting = false;
  let waveCounter = 0;
  let totalSent = 0;
  let inFlightConnects = 0;

  /** action per socket */
  async function sendActionForSocket(sock) {
    if (sock.ws.readyState !== WebSocket.OPEN) return;

    if (NEEDS_AUTH_FIRST.has(type) && !sock.didAuth) {
      sock.ws.send(makeAuthString(group.jwt));
      sock.didAuth = true;
      await sleep(200);
    }

    const withdrawalId = pickWithdrawalId(group);
    if (type === "withdraw") sock.ws.send(makeWithdrawString(withdrawalId));
    if (type === "jump") sock.ws.send(makeJumpString(withdrawalId));
  }

  /** blast loop */
  function blastWave() {
    const live = sockets
      .filter(s => s.ws.readyState === WebSocket.OPEN)
      .slice(0, ACTIVE_LIMIT); // 🔥 only use first 100

    if (!live.length) {
      console.log(`⚠ [Acc#${accountIndex}] No live sockets remain`);
      sendingStarted = false;
      blasting = false;
      return;
    }

    blasting = true;
    waveCounter++;
    let sentThisWave = 0;

    for (const sock of live) {
      setTimeout(() => {
        sendActionForSocket(sock).then(() => sentThisWave++);
      }, 0);
    }

    setTimeout(() => {
      totalSent += sentThisWave;
      console.log(
        `⚡ [Acc#${accountIndex}] Wave #${waveCounter}: sent=${sentThisWave} · liveUsed=${live.length}/${ACTIVE_LIMIT} · connected=${sockets.length}/${TOTAL_SOCKETS}`
      );
      blasting = false;
      setTimeout(blastWave, 1500);
    }, 200);
  }

  /** start sending when enough sockets connected */
  function startSendingIfReady() {
    if (sendingStarted) return;
    if (sockets.length < ACTIVE_LIMIT) return; // wait until at least 100 are ready
    sendingStarted = true;
    console.log(`🚀 [Acc#${accountIndex}] Using first ${ACTIVE_LIMIT} sockets (out of ${sockets.length} connected/${TOTAL_SOCKETS} total)...`);
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
        console.log(`✅ [Acc#${accountIndex}] Socket ${socketId} connected (${sockets.length}/${TOTAL_SOCKETS})`);
        ws.on("message", (m) => {
          try {
            const msg = JSON.parse(m.toString());
            if (msg.error) console.log(`⚠️ [Acc#${accountIndex}]`, msg.error);
          } catch {}
        });
        startSendingIfReady();
        resolve();
      });

      ws.on("message", (m) => {
        const msg = JSON.parse(m.toString());
        if (msg.type === 'data') {
          console.log(msg);
        }
      })

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

  /** boot sockets (all 300) */
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

  console.log(`🔌 [Acc#${accountIndex}] Opening ${TOTAL_SOCKETS} sockets (only ${ACTIVE_LIMIT} will be used) in ${type.toUpperCase()} mode...`);
  bootOpenSockets(TOTAL_SOCKETS).catch(err => {
    console.error(`❌ [Acc#${accountIndex}] bootOpenSockets fatal:`, err?.message || err);
  });
}

/** ====== BOOT ALL JWT GROUPS ====== */
jwtGroups.forEach((group, idx) => {
  setTimeout(() => runGroup(group, idx + 1), idx * 2000);
});
