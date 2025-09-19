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
const ACTIVE_LIMIT = 40;   // but only *use* this many once connected

// Max jumps per withdrawal ID
const MAX_JUMPS_PER_ID = 30;

/** ====== INPUT: MULTI-JWT + WITHDRAW IDS ====== */
const jwtGroups = [
  {
    jwt: "Bearer eyJhbGciOiJFUzI1NiIsInR5cCI6IkpXVCIsImtpZCI6IlU3bU9NMzBNZGJRY3RQMmdoWE4wU0dhTDFIWjNSUWVoZWxkZUNHNF9OaWsifQ.eyJzaWQiOiJjbWZxNWl5djgwMGZ2bDEwY3RpbnNjbGhhIiwiaXNzIjoicHJpdnkuaW8iLCJpYXQiOjE3NTgyNDQ3NDksImF1ZCI6ImNtN2dldjVzNjAwdmJrMmxzajZlMWU5ZzciLCJzdWIiOiJkaWQ6cHJpdnk6Y21kMTUxdzhtMDQwM2xlMG02NDV1c3JrcSIsImV4cCI6MTc1ODI0ODM0OH0.y7vl4AkekPwvkY-OV0Etc4IWPyIS0IpTxgACVWBcmUc8_4Kv1iPFwM32VDbfCllk8BbHMZ3avsflV4fU98AKIQ",
    withdrawals: [
        // GeeBaby
        // "535657fd-365e-4e99-a4eb-6054f34f6a0a",
        // "4e7e6882-eff6-49f8-8cde-08beffe39b3e",
        // "db6fb7dd-c7ba-4c11-97ce-37530b374bd0",
        // "8c162aa7-5a95-454f-b7ee-8c870eb49919",
        // "6ec75923-5c09-412f-b762-8d1b84469428",
        // "0909df82-c2b2-4ccc-9c10-15b60ba6052d",
        // "ceaa7727-e0e7-4f64-9bad-41d8cd9192f1",
        // "7d2578ee-d448-4b96-a528-10bb6a485f6e",
        // "87ec7da0-4d88-4692-8fd8-24378705b0fd",
        // thecreeptoguy
        "61c8298f-5129-4897-91ee-e77c1bb37172",
        "4741702a-1332-44f1-9e7f-d4048425f15e",
        "e7bddcc2-0991-49d7-a62f-7eca37ac8dc3",
        "772d5cf1-b8ab-44e5-b5a1-653d17ce8a4c",
        "e44b4b1c-48d4-48cd-9ef6-ed8b69020dea",
        // "1171321b-8c9b-41ee-b1cd-da8de8237026",
        // "adab2d62-4b36-4c51-b4d2-c091d1bcbaa3",
        "39580c9f-6528-4d79-aef0-d37fc7036560",
        // "6b9ce39c-8d17-4597-b9c0-434a75e7f619",
    ],
  },
];

/** ====== HELPERS ====== */
const sleep = (ms) => new Promise(r => setTimeout(r, ms));
const uniqueNonce = () => uuidv4();

/** ====== MESSAGE BUILDERS ====== */
const makeAuthString = (jwt) => JSON.stringify({
  type: "AUTH",
  data: { params: { authType: "privy", authHash: { hash: jwt } } },
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

  // Track jump usage per withdrawal ID
  let currentWithdrawalIndex = 0;
  let jumpsUsed = 0;

  function getNextWithdrawalId() {
    const currentId = group.withdrawals[currentWithdrawalIndex];
    if (jumpsUsed >= MAX_JUMPS_PER_ID) {
      currentWithdrawalIndex++;
      jumpsUsed = 0;
      if (currentWithdrawalIndex >= group.withdrawals.length) {
        console.log(`✅ [Acc#${accountIndex}] All withdrawal IDs exhausted`);
        return null;
      }
    }
    jumpsUsed++;
    return group.withdrawals[currentWithdrawalIndex];
  }

  /** action per socket */
  async function sendActionForSocket(sock) {
    if (sock.ws.readyState !== WebSocket.OPEN) return;

    if (NEEDS_AUTH_FIRST.has(type) && !sock.didAuth) {
      sock.ws.send(makeAuthString(group.jwt));
      sock.didAuth = true;
      await sleep(200);
    }

    const withdrawalId = getNextWithdrawalId();
    if (!withdrawalId) return; // no IDs left

    if (type === "jump") sock.ws.send(makeJumpString(withdrawalId));
  }

  /** blast loop */
  function blastWave() {
    const live = sockets
      .filter(s => s.ws.readyState === WebSocket.OPEN)
      .slice(0, ACTIVE_LIMIT); // only use the first N

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
    if (sockets.length < ACTIVE_LIMIT) return;
    sendingStarted = true;
    console.log(`🚀 [Acc#${accountIndex}] Using first ${ACTIVE_LIMIT} sockets...`);
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
        startSendingIfReady();
        resolve();
      });

      ws.on("message", (m) => {
        try {
          const msg = JSON.parse(m.toString());
          if (msg.error) console.log(`⚠️ [Acc#${accountIndex}]`, msg.error);
        } catch {}
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
