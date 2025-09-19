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
const ACTIVE_LIMIT = 40;  // but only *use* this many once connected

/** ====== INPUT: MULTI-JWT + WITHDRAW IDS ====== */
const jwtGroups = [
  {
    jwt: "Bearer eyJhbGciOiJFUzI1NiIsInR5cCI6IkpXVCIsImtpZCI6IlU3bU9NMzBNZGJRY3RQMmdoWE4wU0dhTDFIWjNSUWVoZWxkZUNHNF9OaWsifQ.eyJzaWQiOiJjbWZxMzdvbjQwMDJmbGQwZHFhMXdmcTc2IiwiaXNzIjoicHJpdnkuaW8iLCJpYXQiOjE3NTgyNDA4NjMsImF1ZCI6ImNtN2dldjVzNjAwdmJrMmxzajZlMWU5ZzciLCJzdWIiOiJkaWQ6cHJpdnk6Y21lMGx0N25mMDA5MWpsMGJ6b2tybDB4aiIsImV4cCI6MTc1ODI0NDQ2M30.YBdPGbGWMkYh61Qd2mcZQT0d-B0zC2Erd0e_OpQfjM3UnJbIRGLEgdtn53FNZqGrmbl4yH3rQiT_qXkbPOpDvw",
    withdrawals: [
      // Gamby
      // "8fe82985-cd89-4578-a4fe-5da90cefb66b",
      // "1c027585-0a08-451c-8ee1-c891f9cfbaa2",
      // "43a0b6a3-75cc-49ea-9906-7dc0f8cdc25e",
      // "d820f693-bbb5-44ae-9d60-f9e21344f52b",
      // "eadf6782-70e8-405f-924f-e86d1330a937",
      // "5f561d7a-8808-4d1f-bc13-9be768323034",
      // "cfb63d8f-851e-4e8f-857f-d92cfcbfab94",
      // "80af74cd-1cc8-4287-a045-86164607636c",
      // "b09e0b5e-f137-4f37-9173-7c02071a53c3",
      // GeeBaby
      "535657fd-365e-4e99-a4eb-6054f34f6a0a",
      "4e7e6882-eff6-49f8-8cde-08beffe39b3e",
      "db6fb7dd-c7ba-4c11-97ce-37530b374bd0",
      "8c162aa7-5a95-454f-b7ee-8c870eb49919",
      "6ec75923-5c09-412f-b762-8d1b84469428",
      "0909df82-c2b2-4ccc-9c10-15b60ba6052d",
      "ceaa7727-e0e7-4f64-9bad-41d8cd9192f1",
      "7d2578ee-d448-4b96-a528-10bb6a485f6e",
      "87ec7da0-4d88-4692-8fd8-24378705b0fd",
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
