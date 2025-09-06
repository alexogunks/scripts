import WebSocket from "ws";
import { v4 as uuidv4 } from "uuid";

const endpoint = "wss://petbot-monorepo-websocket-333713154917.europe-west1.run.app/";
const jwt = "Bearer eyJhbGciOiJFUzI1NiIsInR5cCI6IkpXVCIsImtpZCI6IlU3bU9NMzBNZGJRY3RQMmdoWE4wU0dhTDFIWjNSUWVoZWxkZUNHNF9OaWsifQ.eyJzaWQiOiJjbWY4OWpieG0wMDJ2a3kwYnF2aHltZnh0IiwiaXNzIjoicHJpdnkuaW8iLCJpYXQiOjE3NTcxNzAxNjUsImF1ZCI6ImNtN2dldjVzNjAwdmJrMmxzajZlMWU5ZzciLCJzdWIiOiJkaWQ6cHJpdnk6Y21mODlqYnoxMDAyeGt5MGIzZ3NhOHhhYyIsImV4cCI6MTc1NzE3Mzc2NX0.7dPG8eflGl6FjBJeMc8zktXe0f2x7B2DpItaH8xTvziUB72FG3BLuFhjCcSLEtexuKjulHaym-HM3qAxtD3PMA";
const origin = "https://app.pett.ai";

let ws;
let totalRequestsSent = 0;
const messagesPerSecond = 1000;
let spamInterval;

function sendMessagesPerSecond(count) {
  const now = new Date();
  const time = now.toLocaleTimeString();

  for (let i = 0; i < count; i++) {
    // const message = {
    //   type: "TRANSFER",
    //   data: {
    //     params: {
    //       // petTo: "a201e041-5122-4da6-b9bd-27433448e5c9",
    //       petTo: "0949b429-1139-4bb6-850e-25acb98fee57",
    //       amount: "1000000000000000000000"
    //     }
    //   },
    //   nonce: uuidv4()
    // };

    const message = {
      type: "PLAY_DICE",
      data: {
          params: {
              betAmount: 100,
              selectedBet: {
                  type: "odd"
              }
          }
      },
      nonce: uuidv4()
    };

    ws.send(JSON.stringify(message));
    totalRequestsSent++;
  }

  console.log(`Sent ${count} messages at ${time}`);
  console.log(`Total sent so far: ${totalRequestsSent}`);
}

function startSpamLoop() {
  if (spamInterval) clearInterval(spamInterval);
  spamInterval = setInterval(() => {
    sendMessagesPerSecond(messagesPerSecond);
  }, 10);
}

function connect() {
  ws = new WebSocket(endpoint, { headers: { Origin: origin } });

  ws.on("open", () => {
    console.log("✅ Connected");

    // send AUTH message
    const authMessage = {
      type: "AUTH",
      data: {
        params: {
          authType: "privy",
          authHash: { hash: jwt }
        }
      },
      nonce: uuidv4()
    };

    ws.send(JSON.stringify(authMessage));
  });

  ws.on("message", (data) => {
    const msg = JSON.parse(data.toString());
    console.log("📨 Received:", msg);

    if (msg.type === "auth_result") {
      if (msg.success) {
        console.log("🔑 Authenticated, starting spam loop...");
        startSpamLoop();
      } else {
        console.error("❌ Auth failed:", msg.error);
      }
    }
  });

  ws.on("close", () => {
    console.log("🔒 Connection closed, retrying in 3s...");
    clearInterval(spamInterval);
    setTimeout(connect, 3000);
  });

  ws.on("error", (err) => {
    console.error("❌ Error:", err.message);
  });
}

connect();
