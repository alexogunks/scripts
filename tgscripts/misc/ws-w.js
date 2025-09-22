import fs from "fs";
import WebSocket from "ws";
import { v4 as uuidv4 } from "uuid";

const endpoint = "wss://petbot-monorepo-websocket-333713154917.europe-west1.run.app/";
const origin = "https://app.pett.ai";
const jwt = "Bearer eyJhbGciOiJFUzI1NiIsInR5cCI6IkpXVCIsImtpZCI6IlU3bU9NMzBNZGJRY3RQMmdoWE4wU0dhTDFIWjNSUWVoZWxkZUNHNF9OaWsifQ.eyJzaWQiOiJjbWZoY2dhdXkwMDVoanUwYXkwMnc4YmV5IiwiaXNzIjoicHJpdnkuaW8iLCJpYXQiOjE3NTg0OTYyMjAsImF1ZCI6ImNtN2dldjVzNjAwdmJrMmxzajZlMWU5ZzciLCJzdWIiOiJkaWQ6cHJpdnk6Y21lbnNmaGFlMDA2ZGw5MGNrdjU2cmtyYSIsImV4cCI6MTc1ODQ5OTgyMH0.wRl_gAd434IQ0EtmT8eHS6Se5Rpp73yXo3WHat10fH7lCWImarD6NGrw81q6ZA5ZPIL_ulHpOXwQCVIq4sm1AQ"

/** ====== Load IDs from file ====== */
const withdrawalIds = fs.readFileSync("withdrawalId.txt", "utf-8")
  .split("\n")
  .map(l => l.trim())
  .filter(Boolean);

let currentIndex = 0;

/** ====== Helpers ====== */
function uniqueNonce() { return uuidv4(); }

function makeAuthString() {
  return JSON.stringify({
    type: "AUTH",
    data: { params: { authType: "privy", authHash: { hash: jwt } } },
    nonce: uniqueNonce(),
  });
}

function makeWithdrawString(withdrawalId) {
  return JSON.stringify({
    type: "WITHDRAWAL_USE",
    data: { params: { withdrawalId } },
    nonce: uniqueNonce(),
  });
}

/** ====== Sequential withdrawal runner ====== */
async function runWithdrawals() {
  if (currentIndex >= withdrawalIds.length) {
    console.log("✅ All withdrawal IDs processed");
    return;
  }

  const withdrawalId = withdrawalIds[currentIndex];
  console.log(`🔌 Processing withdrawalId: ${withdrawalId}`);

  const headers = { Origin: origin, "User-Agent": "Mozilla/5.0" };
  const ws = new WebSocket(endpoint, { headers, perMessageDeflate: false });

  let spamInterval;

  ws.on("open", () => {
    console.log("✅ Connected, authenticating...");
    ws.send(makeAuthString());

    // after a short delay, start spamming WITHDRAWAL_USE until we get success
    setTimeout(() => {
      console.log(`💸 Starting WITHDRAWAL spam for ${withdrawalId}`);
      spamInterval = setInterval(() => {
        ws.send(makeWithdrawString(withdrawalId));
      }, 3000); // send every 1s
    }, 1500);
  });

  ws.on("message", (m) => {
    let msg;
    try { msg = JSON.parse(m.toString()); } catch { return; }
    console.log(msg);
    if (msg.type === "data") {
      console.log(`📩 Received data for ${withdrawalId}, moving to next...`);
      clearInterval(spamInterval);
      ws.close();
      currentIndex++;
      setTimeout(runWithdrawals, 2000); // short delay before next
    }
  });

  ws.on("close", () => console.log("🔒 Socket closed"));
  ws.on("error", (err) => console.error("❌ WebSocket error:", err.message));
}

/** ====== Start ====== */
runWithdrawals();
