import WebSocket from "ws";
import { v4 as uuidv4 } from "uuid";

const endpoint = "wss://petbot-monorepo-websocket-333713154917.europe-west1.run.app/";
const jwt = "Bearer eyJhbGciOiJFUzI1NiIsInR5cCI6IkpXVCIsImtpZCI6IlU3bU9NMzBNZGJRY3RQMmdoWE4wU0dhTDFIWjNSUWVoZWxkZUNHNF9OaWsifQ.eyJzaWQiOiJjbWY4ODF2bWEwMHMxbGEwYmpibW1kZ3d0IiwiaXNzIjoicHJpdnkuaW8iLCJpYXQiOjE3NTcxNjA1OTksImF1ZCI6ImNtN2dldjVzNjAwdmJrMmxzajZlMWU5ZzciLCJzdWIiOiJkaWQ6cHJpdnk6Y21mODgxdm8zMDBzM2xhMGIzbm5sMjVpdCIsImV4cCI6MTc1NzE2NDE5OX0.kDT09eTSbGx-zSvgJKtIDT96p7e3iIaS_vmJt_ybC9XrTo_ztaqhbFI91FyT2AazunK8QV1DhaSMVxnfWeJrTA";
const origin = "https://app.pett.ai";

const pettName = `ao_${Math.round(Math.random() * 999)}_ran_${Math.round(Math.random() * 999)}`;
console.log('Pett Name = ' + pettName)

const connections = 15;
const messagesPerSocket = 100;

let sockets = [];

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
  const payloads = sockets.flatMap(sock =>
    Array.from({ length: messagesPerSocket }, () => ({
      sock,
      msg: JSON.stringify(buildSpamMessage())
    }))
  );

  console.log(`🚀 Sending burst of ${payloads.length} messages...`);

  // Slightly defer to ensure all sockets are fully ready
  setImmediate(() => {
    payloads.forEach(({ sock, msg }) => {
      if (sock.readyState === WebSocket.OPEN) {
        sock.send(msg);
      }
    });
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
        console.log(msg);
        if (msg.type === "auth_result") {
          console.log(`✅ Socket ${index + 1} authenticated`);
          console.log(`Tokens = ${Math.round(Number(msg?.pet?.PetTokens?.tokens) / Number(1000000000000000000))}, Error = ${msg?.error}`);
          sockets.push(ws);
          resolve();
        }
      } catch (e) {
        console.error("Parse error:", e);
      }
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

  console.log(`🎉 All ${connections} sockets authenticated`);
  sendBurst();
}

main();
