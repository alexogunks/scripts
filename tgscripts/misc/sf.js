const type = 1

const endpoint = 'https://api.vankedisitrader.com/api/trading/buy';
// const endpoint = 'https://api.vankedisitrader.com/api/achievements/claim';

const origin = 'https://app.handlpay.com';

const authHeader = 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOjgwMiwidGVsZWdyYW1JZCI6IjY1NjI4NDE4MTIiLCJpYXQiOjE3Njc2NDU2NTUsImV4cCI6MTc2ODI1MDQ1NX0.gUr_PbXTB_raK2EZEUSYT_44xGrfTrmrn18vrq0B4kI';

const payload = {
  "sessionId": "sess_1767465357214_sqw00m3ve",
  "percentage": 0.000000000000000000000000000000000000000000000000000000000000000000000000000000001,
  "isPresale": true,
  // "achievementId": "ten_pulls_later"
};

const queries = [
    'just_1_acc'
];

let s = 0;
let r = 0;

const MAX_CONCURRENCY = 500;
const BASE_DELAY = 1;
const MAX_DELAY = 2;

let active = 0;
let delay = BASE_DELAY;
let queue = [...queries];

async function worker(id) {
  while (queue.length) {
    // const job = queue.shift();
    active++;

    try {
      const res = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Authorization': authHeader,
          'Content-Type': "application/json",
          // 'Origin': origin,
        },
        body: JSON.stringify(payload)
      });
      s++
    //   console.log(s)

      if (res.status === 429) {
        delay = Math.min(delay * 2, MAX_DELAY);
        // await sleep(delay);
        // queue.unshift(job);
        continue;
      }

      delay = Math.max(BASE_DELAY, delay * 0.9);
      const data = await res.json();
      console.log(`✅ Worker ${id}`, data);
      r++
      console.log(r)

    } catch (e) {
      console.log(`❌ Worker ${id}`, e.message);
    } finally {
      active--;
      // await sleep(delay + Math.random() * 1);
    }
  }
}

function sleep(ms) {
  return new Promise(r => setTimeout(r, ms));
}

(async () => {
  const workers = [];
  for (let i = 0; i < MAX_CONCURRENCY; i++) {
    workers.push(worker(i));
  }
  await Promise.all(workers);
  console.log("🎯 Done");
})();