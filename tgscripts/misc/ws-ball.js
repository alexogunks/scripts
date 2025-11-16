import fs from "fs";
import WebSocket from "ws";
import { v4 as uuidv4 } from "uuid";

const endpoint = "wss://ws.pett.ai/";
const origin = "https://app.pett.ai";

const jwt = fs.readFileSync("jwt.txt", "utf-8").split("\n")[0].trim();

const connections = 1;
const messagesPerSocket = 5;

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
    type: "THROWBALL",
    data: {},
    nonce: uuidv4()
}}

let msgSent = 0;
let msgRec = 0;
let i = 0;

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
      setInterval(() => {
        sock.send(msg);
        msgSent += 1
        i++
        console.log(`Sent message ${i}`)
        if ((msgSent > 4 || i > 4) && msgRec >= 3) process.exit();
      }, 1000)
    }
    if (msgSent >= 1) sock.close()
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
        // console.log(msg);
        if (msg?.type === 'data') msgRec++
        if (msg.type === "auth_result" && msg.success) {
          console.log(`✅ Socket ${index + 1} authenticated`);
        //   console.log(`Tokens = ${Math.round(Number(msg?.pet?.PetTokens?.tokens) / Number(1000000000000000000))}`);
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
  console.log(`🎉 Bursts sent`);
  if ((msgSent >= 3 || i >= 3) && msgRec >= 3) process.exit();
//   return;
}

main();