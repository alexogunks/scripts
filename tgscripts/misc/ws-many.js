import WebSocket from "ws";
import { v4 as uuidv4 } from "uuid";

const endpoint = "wss://petbot-monorepo-websocket-333713154917.europe-west1.run.app/";
const origin = "https://app.pett.ai";

// === PUT 20 JWTs HERE ===
const jwts = [
    "Bearer eyJhbGciOiJFUzI1NiIsInR5cCI6IkpXVCIsImtpZCI6IlU3bU9NMzBNZGJRY3RQMmdoWE4wU0dhTDFIWjNSUWVoZWxkZUNHNF9OaWsifQ.eyJzaWQiOiJjbWZqMGVsNTEwMGtmbGEwY3IxZnpzc3BzIiwiaXNzIjoicHJpdnkuaW8iLCJpYXQiOjE3NTc4MTI4ODMsImF1ZCI6ImNtN2dldjVzNjAwdmJrMmxzajZlMWU5ZzciLCJzdWIiOiJkaWQ6cHJpdnk6Y21majBlbDZ4MDBraGxhMGM4bmF1MmZmOSIsImV4cCI6MTc1NzgxNjQ4M30.FhWGcu4dGBqBtD9nXjtW0MNwPy0cu08deaM6bUR3LejAJGVrbYMseoVVDizLVMw8fF-FhwnRLdcPmN_G8J0EeQ",
    "Bearer eyJhbGciOiJFUzI1NiIsInR5cCI6IkpXVCIsImtpZCI6IlU3bU9NMzBNZGJRY3RQMmdoWE4wU0dhTDFIWjNSUWVoZWxkZUNHNF9OaWsifQ.eyJzaWQiOiJjbWZqMGVsNTEwMGtmbGEwY3IxZnpzc3BzIiwiaXNzIjoicHJpdnkuaW8iLCJpYXQiOjE3NTc4MTI4ODMsImF1ZCI6ImNtN2dldjVzNjAwdmJrMmxzajZlMWU5ZzciLCJzdWIiOiJkaWQ6cHJpdnk6Y21majBlbDZ4MDBraGxhMGM4bmF1MmZmOSIsImV4cCI6MTc1NzgxNjQ4M30.FhWGcu4dGBqBtD9nXjtW0MNwPy0cu08deaM6bUR3LejAJGVrbYMseoVVDizLVMw8fF-FhwnRLdcPmN_G8J0EeQ",
    "Bearer eyJhbGciOiJFUzI1NiIsInR5cCI6IkpXVCIsImtpZCI6IlU3bU9NMzBNZGJRY3RQMmdoWE4wU0dhTDFIWjNSUWVoZWxkZUNHNF9OaWsifQ.eyJzaWQiOiJjbWZqMGVsNTEwMGtmbGEwY3IxZnpzc3BzIiwiaXNzIjoicHJpdnkuaW8iLCJpYXQiOjE3NTc4MTI4ODMsImF1ZCI6ImNtN2dldjVzNjAwdmJrMmxzajZlMWU5ZzciLCJzdWIiOiJkaWQ6cHJpdnk6Y21majBlbDZ4MDBraGxhMGM4bmF1MmZmOSIsImV4cCI6MTc1NzgxNjQ4M30.FhWGcu4dGBqBtD9nXjtW0MNwPy0cu08deaM6bUR3LejAJGVrbYMseoVVDizLVMw8fF-FhwnRLdcPmN_G8J0EeQ",
    "Bearer eyJhbGciOiJFUzI1NiIsInR5cCI6IkpXVCIsImtpZCI6IlU3bU9NMzBNZGJRY3RQMmdoWE4wU0dhTDFIWjNSUWVoZWxkZUNHNF9OaWsifQ.eyJzaWQiOiJjbWZqMGVsNTEwMGtmbGEwY3IxZnpzc3BzIiwiaXNzIjoicHJpdnkuaW8iLCJpYXQiOjE3NTc4MTI4ODMsImF1ZCI6ImNtN2dldjVzNjAwdmJrMmxzajZlMWU5ZzciLCJzdWIiOiJkaWQ6cHJpdnk6Y21majBlbDZ4MDBraGxhMGM4bmF1MmZmOSIsImV4cCI6MTc1NzgxNjQ4M30.FhWGcu4dGBqBtD9nXjtW0MNwPy0cu08deaM6bUR3LejAJGVrbYMseoVVDizLVMw8fF-FhwnRLdcPmN_G8J0EeQ",
];

// 

let tokenBalance;

// target sockets in total
const TOTAL_SOCKETS = 800;
const socketsPerJwt = Math.floor(TOTAL_SOCKETS / jwts.length);

// ---- MESSAGE HELPERS ----
const makeRegisterString = (jwt, name) => JSON.stringify({
  type: "REGISTER",
  data: { params: { authType: "privy", registerHash: { hash: jwt, name } } },
  nonce: uuidv4(),
});

const makeAuthString = (jwt) => JSON.stringify({
  type: "AUTH",
  data: { params: { authType: "privy", authHash: { hash: jwt } } },
  nonce: uuidv4(),
});

const makeBuyString = () => JSON.stringify({
  type: "CONSUMABLES_BUY",
  data: { params: { foodId: "ENERGIZER", amount: 1 } },
  nonce: uuidv4(),
});

const makeAtmString = () => JSON.stringify({
    type: "TRANSFER",
    data: {
        params: {
            petTo: "23d430f9-e9f8-4788-a1a3-97c9476dad28",
            // amount: 0
            amount: Number(Math.floor(tokenBalance - Number(tokenBalance * 0.1 / 100)))
        }
    },
    nonce: uuidv4()
});

// ---- CONFIG PER TYPE ----
const CONFIGS = {
  register: {
    TOTAL_SOCKETS: socketsPerJwt,
    REQUESTS_PER_SOCKET: 4,
    BLAST_DURATION_MS: 40,
    REST_BETWEEN_WAVES_MS: 30000,
    handler: (ws, jwt, name) => {
      ws.send(makeRegisterString(jwt, name));
    },
  },
  food: {
    TOTAL_SOCKETS: 10,
    REQUESTS_PER_SOCKET: 4,
    BLAST_DURATION_MS: 40,
    REST_BETWEEN_WAVES_MS: 1000,
    handler: (ws, jwt) => {
      ws.send(makeAuthString(jwt));
      ws.send(makeBuyString());
    },
  },
  atm: {
    TOTAL_SOCKETS: 10,
    REQUESTS_PER_SOCKET: 1,
    BLAST_DURATION_MS: 40,
    REST_BETWEEN_WAVES_MS: 2000,
    handler: (ws, jwt) => {
        tokenBalance >= 100 * 1000000000000000000 && ws.send(makeAuthString(jwt));
        tokenBalance >= 100 * 1000000000000000000 && ws.send(makeAtmString());
    },
  },
};

// ---- GROUP RUNNER ----
function runGroup(jwt, accountIndex) {
  const pettName = `ao_cb_${Math.floor(Math.random() * 999)}_rs_${Math.floor(
    Math.random() * 999
  )}`;

  let type = "register";
  let sockets = [];
  let totalReceived = 0;
  let currentLevel = 0;
  let blasting = false;
  let waveCounter = 0;

  function blastWave() {
    const cfg = CONFIGS[type];
    const live = sockets.filter((s) => s.ws.readyState === WebSocket.OPEN);
    if (!live.length) {
      console.log(`⚠️ [Acc#${accountIndex}] No live sockets remain`);
      return;
    }

    blasting = true;
    waveCounter++;
    let sent = 0;

    const interval = cfg.BLAST_DURATION_MS / cfg.REQUESTS_PER_SOCKET;

    for (const { ws } of live) {
      for (let j = 0; j < cfg.REQUESTS_PER_SOCKET; j++) {
        setTimeout(() => {
          try {
            cfg.handler(ws, jwt, pettName);
            sent++;
          } catch {}
        }, j * interval);
      }
    }

    setTimeout(() => {
      console.log(
        `⚡ [Acc#${accountIndex}] Wave #${waveCounter} sent=${sent} sockets=${live.length}`
      );
      blasting = false;
      setTimeout(blastWave, cfg.REST_BETWEEN_WAVES_MS);
    }, cfg.BLAST_DURATION_MS + 20);
  }

  function switchType(newType) {
    console.log(`🔄 [Acc#${accountIndex}] Switching → ${newType}`);
    type = newType;
    // close sockets cleanly before relaunch
    sockets.forEach((s) => s.ws.close());
    sockets = [];
    setTimeout(() => {
      for (let i = 0; i < CONFIGS[newType].TOTAL_SOCKETS; i++) {
        setTimeout(() => connectSocket(i + 1), i * 100);
      }
    }, 2000); // grace delay before reopening
  }

  function connectSocket(socketId) {
    const headers = { Origin: origin, "User-Agent": "Mozilla/5.0" };
    const ws = new WebSocket(endpoint, { headers, perMessageDeflate: false });

    ws.on("open", () => {
      sockets.push({ ws, id: socketId });
      console.log(`✅ [Acc#${accountIndex}] Socket ${socketId} connected`);

      if (sockets.length === CONFIGS[type].TOTAL_SOCKETS && !blasting) {
        console.log(`🚀 [Acc#${accountIndex}] All sockets ready — starting waves`);
        blastWave();
      }
    });

    ws.on("message", (m) => {
      const msg = JSON.parse(m.toString());

      // track level
      if (msg?.pet?.PetStats?.level) {
        currentLevel = Number(msg.pet.PetStats.level);
        console.log(`📊 [Acc#${accountIndex}] Level: ${currentLevel}`);
        if (currentLevel >= 10 && type !== "atm") {
          switchType("atm");
        }
      }

      // track cm count
      if (msg.error?.toLowerCase() === "user already created") {
        totalReceived += 1;
        console.log(`📥 [Acc#${accountIndex}] cm=${totalReceived}`);
        if (totalReceived > 300 && type === "register") {
          switchType("food");
        }
      }

      // track token balance
    if (msg?.pet?.PetTokens?.tokens != null) {
        tokenBalance = Number(msg.pet.PetTokens.tokens);
        const tokenBalanceDisplay = Number(tokenBalance / 1000000000000000000)
        console.log(`💰 Token balance: ${tokenBalanceDisplay}`);
        // console.log(`---${Number(Math.floor(tokenBalance - Number(tokenBalance * 0.1 / 100))/1000000000000000000)}`)
      }
    });

    ws.on("close", () => {
      sockets = sockets.filter((s) => s.ws !== ws);
    });

    ws.on("error", (err) => {
      console.error(`❌ [Acc#${accountIndex}] Socket ${socketId} error:`, err.message);
    });
  }

  console.log(`🔌 [Acc#${accountIndex}] Opening ${socketsPerJwt} sockets...`);
  for (let i = 0; i < socketsPerJwt; i++) {
    setTimeout(() => connectSocket(i + 1), i * 100);
  }
}

// ---- BOOT ALL JWT GROUPS ----
jwts.forEach((jwt, idx) => {
  setTimeout(() => runGroup(jwt, idx + 1), idx * 2000);
});
