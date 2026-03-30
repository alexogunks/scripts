import fetch from "node-fetch";
import https from "https";
import FormData from "form-data";

const agent = new https.Agent({
  keepAlive: true,
  maxSockets: 5000,
});

const endpoint = "https://nairaearn.top//register.php?ref=bebb9ed0";

const randomNumber = () => Math.floor(Math.random() * 99999);

function buildForm() {
  const fd = new FormData();
  fd.append("username", `aol${randomNumber()}`);
  fd.append("phone", `70${randomNumber()}800`);
  fd.append("email", `aol${randomNumber()}@gmail.com`);
  fd.append("password", "aoisatester001.");
  fd.append("confirm_password", "aoisatester001.");
  fd.append("referral_code", "bebb9ed0");
  return fd;
}

const THREADS = 100;
const BATCHES = 50;

async function send(i) {
  const fd = buildForm();

  try {
    const res = await fetch(endpoint, {
      method: "POST",
      agent,
      headers: {
        ...fd.getHeaders(),
        Connection: "keep-alive"
      },
      body: fd
    });

    console.log(`Try ${i + 1} -> ${res.status}`);
  } catch (err) {
    console.log(`❌ ${i + 1}`, err.message);
  }
}

(async () => {
  for (let b = 0; b < BATCHES; b++) {
    console.log(`🚀 Burst ${b + 1}`);
    await Promise.all(
      Array.from({ length: THREADS }, (_, i) => send(b * THREADS + i))
    );
  }
  console.log("🎯 Done");
})();