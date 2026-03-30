import fetch from "node-fetch";
import https from "https";
import FormData from "form-data";

const agent = new https.Agent({
  keepAlive: true,
  maxSockets: 5000,
  // timeout: 60000,
});

// const endpoint = 'https://api.vankedisitrader.com/api/trading/buy';
// const endpoint = 'https://api.vankedisitrader.com/api/achievements/claim';
// const endpoint = "https://api.vankedisitrader.com/api/daily-reward/claim";


const endpoint = "https://nairaearn.top//register.php?ref=4a58567f";

const authHeader = 'Bearer 1083e9b50ae58b27dab4b7c92e7d16d9-2d750156b25d1f47327e58f363d128f0-4490e687e6b6c78460489e47399b7c38';

const randomNumber = () => {
  return Math.floor(Math.random() * 99999)
};

const fd = new FormData()

fd.append("username", `aol${randomNumber()}`);
fd.append("phone", `70${randomNumber()}800`);
fd.append("email", `aol${randomNumber()}@gmail.com`);
fd.append("password", `aoisatester001.`);
fd.append("confirm_password", `aoisatester001.`);
fd.append("referral_code", "bebb9ed0");


const payload = {
  // sessionId: "sess_1768524063611_bedx0ioeh",
  // percentage: 100,
  // isPresale: false,
  // achievementId: "rug_survivor",
};

const payloadStr = JSON.stringify(fd);

const THREADS = 10;
const BATCHES = 5;

function send(i) {
  return fetch(endpoint, {
    method: 'POST',
    agent,
    headers: {
      'Content-Type': 'application/json',
      // 'Authorization': authHeader,
      'Connection': 'keep-alive',
      'Cookie': 'PHPSESSID=f74fd797f97419972b25ddd899251430',
    },
    body: fd,
  })
    .then(res => {
      console.log(res);
      if (res.body?.resume) res.body.resume();
      return res.status;
    })
    .then(status => {
      console.log(`Try ${i + 1} -> ${status}`);
    })
    .catch(err => {
      console.log(`❌ ${i + 1}`, err.message);
    });
}

(async () => {
  // console.log("🔥 Warmup");
  // await send(-1);

  for (let b = 0; b < BATCHES; b++) {
    console.log(`🚀 Burst ${b + 1}`);

    const jobs = [];

    // queue first, no awaits here
    for (let i = 0; i < THREADS; i++) {
      jobs.push(send(b * THREADS + i));
    }

    // now wait for all after launch
    await Promise.all(jobs);
  }

  console.log("🎯 Done");
})();