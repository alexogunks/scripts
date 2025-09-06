import WebSocket from "ws";
import { v4 as uuidv4 } from "uuid";

const endpoint = "wss://petbot-monorepo-websocket-333713154917.europe-west1.run.app/";
const jwt = "Bearer eyJhbGciOiJFUzI1NiIsInR5cCI6IkpXVCIsImtpZCI6IlU3bU9NMzBNZGJRY3RQMmdoWE4wU0dhTDFIWjNSUWVoZWxkZUNHNF9OaWsifQ.eyJzaWQiOiJjbWY4MnRxNncwMTlzbDEwYnRhMDQ3bTNrIiwiaXNzIjoicHJpdnkuaW8iLCJpYXQiOjE3NTcxNTE4MjAsImF1ZCI6ImNtN2dldjVzNjAwdmJrMmxzajZlMWU5ZzciLCJzdWIiOiJkaWQ6cHJpdnk6Y21mODJ0cTg2MDE5dWwxMGJkczM2cDAxbCIsImV4cCI6MTc1NzE1NTQyMH0.-LkGgB5EuzEf63XT2ssACuaftQCNYLDIIViHKv0yAyx7-MdO5J95QeNdEInZlJ8cY_224X-USel5be9DTOCavg";
const origin = "https://app.pett.ai";

const pettName = "aocontinues_rs_015";

const connections = 25;
const messagesPerSocket = 30;

let sockets = [];
let readyCount = 0;

function buildAuthMessage() {
  return {
    type: "AUTH",
    data: {
      params: {
        authType: "privy",
        authHash: { hash: jwt }
      }
    },
    nonce: uuidv4()
  };
}

function buildSpamMessage() {
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

function sendBurst() {
  const total = connections * messagesPerSocket;
  console.log(`🚀 Sending burst: ${total} messages total`);

  const payloads = sockets.flatMap(sock =>
    Array.from({ length: messagesPerSocket }, () => ({
      sock,
      msg: JSON.stringify(buildSpamMessage())
    }))
  );

  payloads.forEach(({ sock, msg }) => {
    if (sock.readyState === WebSocket.OPEN) {
      sock.send(msg);
    }
  });
}

function connectSocket(index) {
  return new Promise(resolve => {
    const ws = new WebSocket(endpoint, { headers: { Origin: origin } });

    ws.on("open", () => {
      ws.send(JSON.stringify(buildAuthMessage()));
    });

    ws.on("message", data => {
      try {
        const msg = JSON.parse(data.toString());
        if (msg.type === "auth_result" /*&& msg.success*/) {
          console.log(`✅ Socket ${index + 1} authenticated`);
          console.log(`Tokens = ${Math.round(Number(msg?.pet?.PetTokens?.tokens) / Number(1000000000000000000))}`);
          sockets.push(ws);
          readyCount++;
          resolve();
        }
      } catch (e) {
        console.error("Parse error:", e);
      }
    });

    ws.on("close", () => {
      console.log(`🔒 Socket ${index + 1} closed`);
    });

    ws.on("error", err => {
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

  setInterval(sendBurst, 5000);
}

main();
