import WebSocket from "ws";
import { v4 as uuidv4 } from "uuid";

const endpoint = "wss://petbot-monorepo-websocket-333713154917.europe-west1.run.app/";
const jwt = "Bearer eyJhbGciOiJFUzI1NiIsInR5cCI6IkpXVCIsImtpZCI6IlU3bU9NMzBNZGJRY3RQMmdoWE4wU0dhTDFIWjNSUWVoZWxkZUNHNF9OaWsifQ.eyJzaWQiOiJjbWY4OWpieG0wMDJ2a3kwYnF2aHltZnh0IiwiaXNzIjoicHJpdnkuaW8iLCJpYXQiOjE3NTcxNzM4MzAsImF1ZCI6ImNtN2dldjVzNjAwdmJrMmxzajZlMWU5ZzciLCJzdWIiOiJkaWQ6cHJpdnk6Y21mODlqYnoxMDAyeGt5MGIzZ3NhOHhhYyIsImV4cCI6MTc1NzE3NzQzMH0.1_4XSvs5n7vbQ42aiPcYEsJA6Q2ohrXXwmaWtC6wHL6j5_IyhFl0KnokwX6_o3YiIEq0GQcT0t0H3CNYmlzAEA";
const origin = "https://app.pett.ai";

let ws;
let totalRequestsSent = 0;

const pettName = 'aocontinues_002';

// const messageToSend = {
//     type: "REGISTER",
//     data: {
//       params: {
//         authType: "privy",
//         registerHash: {
//           hash: jwt,
//           name: pettName
//         }
//       }
//     },
//     nonce: uuidv4()
// }

const messageToSend = {
    type: "PLAY_SLOTS",
    data: {
        params: {
            betAmount: 400
        }
    },
    nonce: uuidv4()
};

// const messageToSend = {
//     type: "PLAY_DICE",
//     data: {
//         params: {
//             betAmount: 5000,
//             selectedBet: {
//                 type: "odd"
//             }
//         }
//     },
//     nonce: uuidv4()
// };

const messagesPerBatch = 100;
const batchIntervalMs = 0.00001;

function sendBatch(ws, count) {
  const now = new Date();
  const time = now.toLocaleTimeString();

  let batch = [];
  for (let i = 0; i < count; i++) {
    batch.push(messageToSend);
  }

  for (const msg of batch) {
    ws.send(JSON.stringify(msg));
    totalRequestsSent++;
  }

  console.log(`⚡ Sent batch of ${count} at ${time}`);
  console.log(`📤 Total sent so far: ${totalRequestsSent}`);
}

function startBatchLoop(ws, count, intervalMs) {
  setInterval(() => {
    sendBatch(ws, count);
  }, intervalMs);
}

function connect() {
  ws = new WebSocket(endpoint, { headers: { Origin: origin } });

  ws.on("open", () => {
    console.log("✅ Connected");

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
        console.log("🔑 Authenticated, starting jam-packed batch loop...");
        startBatchLoop(ws, messagesPerBatch, batchIntervalMs);
    } else {
        console.error("❌ Auth failed:", msg.error);
        startBatchLoop(ws, messagesPerBatch, batchIntervalMs);
      }
    }
  });

  ws.on("close", () => {
    console.log("🔒 Connection closed, retrying in 3s...");
    setTimeout(connect, 3000);
  });

  ws.on("error", (err) => {
    console.error("❌ Error:", err.message);
  });
}

connect();
