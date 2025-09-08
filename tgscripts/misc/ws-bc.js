// blast.js
import cluster from "cluster";
import WebSocket from "ws";
import { v4 as uuidv4 } from "uuid";

const endpoint = "wss://petbot-monorepo-websocket-333713154917.europe-west1.run.app/";
const origin = "https://app.pett.ai";
const jwt = "Bearer eyJhbGciOiJFUzI1NiIsInR5cCI6IkpXVCIsImtpZCI6IlU3bU9NMzBNZGJRY3RQMmdoWE4wU0dhTDFIWjNSUWVoZWxkZUNHNF9OaWsifQ.eyJzaWQiOiJjbWZhNmp0b2MwMTUyam8wYjkwY2dzMWs5IiwiaXNzIjoicHJpdnkuaW8iLCJpYXQiOjE3NTcyNzkwMDksImF1ZCI6ImNtN2dldjVzNjAwdmJrMmxzajZlMWU5ZzciLCJzdWIiOiJkaWQ6cHJpdnk6Y21mYTZqdHE0MDE1NGpvMGJ1bmRuaGtldyIsImV4cCI6MTc1NzI4MjYwOX0._ptm17tz4NgTXCPW7CUrZ6_KsdI-FNdTCBEHqPjsm3s8HkxHsvcKWNAB6y5ZUqkeZjK_IPyQPxK2NrzXnOqzig"; // your token

// ---- CONFIG ----
const TOTAL_SOCKETS = 100;        // total sockets you want
const BATCH_SIZE = 100;            // sockets per worker
const REQUESTS_PER_SOCKET = 20;    // <= 30
const BLAST_DURATION_MS = 30; 

const name_prefix = `ao_${Math.floor(Math.random() * 999)}`

// ---- MASTER PROCESS ----
if (cluster.isPrimary) {
  const workers = Math.ceil(TOTAL_SOCKETS / BATCH_SIZE);
  console.log(`🚀 Master: spawning ${workers} workers, ${BATCH_SIZE} sockets each`);

  let readyCount = 0;

  for (let i = 0; i < workers; i++) {
    const worker = cluster.fork({
      BATCH_SIZE,
      WORKER_ID: i + 1,
      REQUESTS_PER_SOCKET,
      BLAST_DURATION_MS,
      endpoint,
      origin,
      jwt,
    });

    worker.on("message", (msg) => {
      if (typeof msg === "string") {
        console.log(`[Worker ${i + 1}] ${msg}`);
        if (msg.startsWith("READY")) {
          readyCount++;
          if (readyCount >= TOTAL_SOCKETS) {
            console.log("✅ All sockets connected — broadcasting START");
            for (const id in cluster.workers) {
              cluster.workers[id].send({ cmd: "START" });
            }
          }
        }
      }
    });
  }
}

// ---- WORKER PROCESSES ----
else {
  const {
    BATCH_SIZE,
    WORKER_ID,
    REQUESTS_PER_SOCKET,
    BLAST_DURATION_MS,
    endpoint,
    origin,
    jwt,
  } = process.env;

  let sockets = [];

  function makeRegisterString(name) {
    return JSON.stringify({
      type: "REGISTER",
      data: {
        params: {
          authType: "privy",
          registerHash: { hash: jwt, name },
        },
      },
      nonce: uuidv4(),
    });
  }

  function connectSocket(socketId) {
    const ws = new WebSocket(endpoint, {
      headers: { Origin: origin },
      perMessageDeflate: false,
    });

    ws.on("open", () => {
      sockets.push(ws);
      process.send?.(`READY socket ${socketId} (${sockets.length}/${BATCH_SIZE})`);
    });

    ws.on("message", (m) => {
      const msg = JSON.parse(m.toString())
      console.log(msg);
    });

    ws.on("error", (err) => {
      process.send?.(`❌ Socket ${socketId} error: ${err.message}`);
    });

    ws.on("close", () => {
      process.send?.(`🔒 Socket ${socketId} closed`);
      sockets = sockets.filter((s) => s !== ws);
    });
  }

  // open batch sockets
  for (let i = 0; i < BATCH_SIZE; i++) connectSocket(i + 1);

  // listen for START signal
  process.on("message", (msg) => {
    if (msg.cmd === "START") {
      process.send?.("⚡ Starting blast");
      const live = sockets.filter((s) => s.readyState === WebSocket.OPEN);
      const interval = BLAST_DURATION_MS / REQUESTS_PER_SOCKET;

      for (const ws of live) {
        for (let j = 0; j < REQUESTS_PER_SOCKET; j++) {
          setTimeout(() => {
            try {
              ws.send(makeRegisterString(`${name_prefix}_w${WORKER_ID}_s${j}`), { compress: false });
            } catch {}
          }, j * interval);
        }
      }
    }
  });
}
