// otp-login.js
import fetch from "node-fetch";
import readline from "readline";

const APP_ID = "cm7gev5s600vbk2lsj6e1e9g7";   // your Privy app ID
const EMAIL  = "ymykfa@mailto.plus";             // replace with your test email

// simple console prompt
function ask(q) {
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  return new Promise(res => rl.question(q, ans => { rl.close(); res(ans); }));
}

async function main() {
  // Step 1: request OTP
  const sendRes = await fetch("https://auth.privy.io/api/v1/otp/send", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ app_id: APP_ID, email: EMAIL })
  });
  const raw = await sendRes.text();
  console.log("Raw response:", raw);
  let sendJson;
  try { sendJson = JSON.parse(raw); } catch { sendJson = {}; }
  
  console.log("Send response:", sendJson);

  // Step 2: get the code from user input
  const code = await ask("Enter the code from your email: ");

  // Step 3: verify code → get JWT
  const verifyRes = await fetch("https://auth.privy.io/api/v1/otp/verify", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ app_id: APP_ID, email: EMAIL, code })
  });
  const verifyJson = await verifyRes.json();

  console.log("Verify response:", verifyJson);

  // Step 4: print JWT
  console.log("\nYour access_token (JWT):", verifyJson.access_token);
  console.log("Use it in requests as: Authorization: Bearer <token>");
}

main().catch(console.error);
