const fetch = (...args) => import('node-fetch').then(({default: fetch}) => fetch(...args));

const queries = [
    "Weyyyyyy"
];

const endpoint = 'https://aiquantify.link/Auth/authentication.php';

const payload = {
  "user_id": 7022281670,
  "first_name": "Alex",
  "last_name": "",
  "username": "alexohgee",
  "lang": "en"
};


(async () => {
  const results = await Promise.all(queries.map(async (query, index) => {
    try {
      const THREADS = 10;
        const BATCHES = 100;
        
        async function send(index) {
          try {
            const res = await fetch(endpoint, {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                // 'Authorization': query,
                'Cookie': 'PHPSESSID=mvbn2c0lsfnnjs48kbhpsjgkut',
              },
              body: JSON.stringify(payload)
            });

            const body = await res.json();
            
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



// const payload = {
//     // amount: 5000,
//     // isETH: "false",
//     idWithdraw: "b0ee8447-728a-47d3-8cb0-0c038c8dca25",
//     user: {
//         id: 6562841812, 
//         first_name: "Alex", 
//         last_name: "Ogunks", 
//         username: "alexogunks", 
//         photo_url: "https://t.me/i/userpic/320/v9BI9n12C4xldYtafBE3d3pU0-I3G-mhi_mxC4WzettCQnZuFqClfixZKAkmPPbb.jpg", 
//         auth_date: 1751740974, 
//         hash: "93cf2e6088c25c56f20e51e90d0195a226f23f95dfec92e7f4bc495c6df7672b",
//     }
// };