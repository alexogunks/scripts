import WebSocket from "ws";
import { v4 as uuidv4 } from "uuid";

const endpoint = "wss://petbot-monorepo-websocket-333713154917.europe-west1.run.app/";
const jwt = "Bearer eyJhbGciOiJFUzI1NiIsInR5cCI6IkpXVCIsImtpZCI6IlU3bU9NMzBNZGJRY3RQMmdoWE4wU0dhTDFIWjNSUWVoZWxkZUNHNF9OaWsifQ.eyJzaWQiOiJjbWY4bnhkamswMTRmbGIwYjhwbGNrODhnIiwiaXNzIjoicHJpdnkuaW8iLCJpYXQiOjE3NTcxODcyNjMsImF1ZCI6ImNtN2dldjVzNjAwdmJrMmxzajZlMWU5ZzciLCJzdWIiOiJkaWQ6cHJpdnk6Y21mOG54ZGwyMDE0aGxiMGI1ZGtjemg5MCIsImV4cCI6MTc1NzE5MDg2M30.ZiRbCkE6a5IOL1UQUG9nbjBB7gQDt82YEgK4tWq9U6TJ0diH_K1zPUoAXrr1Dfe8BIEE4pPTLSksYT0nepvQyQ"

const origin = "https://app.pett.ai";

const pettName = `ao_${Math.floor(Math.random() * 1000)}_ran_${Math.floor(Math.random() * 1000)}`;

const connectionCount = 15;
const messagesPerBatch = 50;
const burstIntervalMs = 2000;

let totalRequestsSent = 0;
let sockets = [];

function makeMessage(socketId) {
  return {
    type: "REGISTER",
    data: {
      params: {
        authType: "privy",
        registerHash: {
          hash: jwt,
          name: pettName
        }
      }
    },
    nonce: uuidv4()
  };
}

// function makeMessage(id) {
//     return {
//         type: "PLAY_SLOTS",
//         data: {
//             params: {
//                 betAmount: 500
//             }
//         },
//         nonce: uuidv4()
//     };
// }

function fireBurst() {
  const now = new Date().toLocaleTimeString();
  let burstCount = 0;

  for (const { ws, id } of sockets) {
    if (ws.readyState === WebSocket.OPEN) {
      for (let i = 0; i < messagesPerBatch; i++) {
        ws.send(JSON.stringify(makeMessage(id)));
        totalRequestsSent++;
        burstCount++;
      }
    }
  }

  console.log(`⚡ Burst fired: ${burstCount} messages @ ${now}`);
  console.log(`📤 Total sent so far: ${totalRequestsSent}`);
}

function connect(socketId) {
  const ws = new WebSocket(endpoint, { headers: { Origin: origin } });

  ws.on("open", () => {
    console.log(`✅ Socket ${socketId} connected`);
    const authMessage = {
      type: "AUTH",
      data: {
        params: { authType: "privy", authHash: { hash: jwt } }
      },
      nonce: uuidv4()
    };
    ws.send(JSON.stringify(authMessage));
  });

  ws.on("message", (data) => {
    const msg = JSON.parse(data.toString());
    console.log(msg)
    if (msg.type === "auth_result" /*&& msg.success*/) {
      console.log(`🔑 Socket ${socketId} authenticated`);
      console.log(msg);
      sockets.push({ ws, id: socketId });

      if (sockets.length === connectionCount) {
        console.log("🚀 All sockets ready, starting synchronized bursts...");
        setInterval(fireBurst, burstIntervalMs);
      }
    } else {
        console.log(`❌ Socket ${socketId} auth failed:`, msg.error);
        sockets.push({ ws, id: socketId });
        if (sockets.length === connectionCount) {
          console.log("🚀 All sockets ready, starting synchronized bursts...");
          setInterval(fireBurst, burstIntervalMs);
        }
    }
  });

  ws.on("close", () => {
    console.log(`🔒 Socket ${socketId} closed`);
  });

  ws.on("error", (err) => {
    console.error(`❌ Socket ${socketId} error:`, err.message);
  });
}

for (let i = 0; i < connectionCount; i++) {
  connect(i + 1);
}