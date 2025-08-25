const fetch = (...args) => import('node-fetch').then(({default: fetch}) => fetch(...args));
// import WebSocket from 'ws';

// const ws = new WebSocket('wss://tonblitzapi.bitsapiens.io/ws?userId=13385');

// ws.on('open', () => {
//   console.log('✅ Connected');

//   if (!ws) {
//     console.error("No WebSocket found");
//   } else {
//     let clicksToSend = 99999999;
//     let delay = 20000000000 / clicksToSend;
  
//     let i = 0;
//     let interval = setInterval(() => {
//       if (i >= clicksToSend) {
//         clearInterval(interval);
//         return;
//       }
  
//       let message = {
//         type: "batchClicks",
//         clicks: 999999999999999,
//         clickData: {
//           position: {
//             x: 200 + Math.floor(Math.random() * 5),
//             y: 300 + Math.floor(Math.random() * 5)
//           },
//           deviceInfo: navigator.userAgent
//         }
//       };
  
//       ws.send(JSON.stringify(message));
//       i++;
//     }, delay);
//   }  
// });

// ws.on('message', (data) => {
//   console.log('📨 Received:', data.toString());
// });

// // ws.on('close', () => {
// //   console.log('🔒 Connection closed');
// // });

// ws.on('error', (err) => {
//   console.error('❌ Error:', err);
// });


const apiKeys = [
    "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOjczMzkxNTYyMjgsImlhdCI6MTc1MjExMDEwNiwiZXhwIjoxNzUyMTEzNzA2fQ.HesJPV-jpIPZrvHa92o6lf1M0HGBtCr4_oyM9RwRf24",
];

const loginData = {
    "init_data": "query_id=AAEEo3I1AwAAAASjcjV_CuRJ&user=%7B%22id%22%3A7339156228%2C%22first_name%22%3A%22Shawn%22%2C%22last_name%22%3A%22%22%2C%22username%22%3A%22oluwashawn01%22%2C%22language_code%22%3A%22en%22%2C%22allows_write_to_pm%22%3Atrue%2C%22photo_url%22%3A%22https%3A%5C%2F%5C%2Ft.me%5C%2Fi%5C%2Fuserpic%5C%2F320%5C%2F67_hiGUURb_uBInK7EXUuvEGUS9h4kwNWw5C4Bojf-wzPwiARl_2TULt6Hra75FZ.svg%22%7D&auth_date=1752379336&signature=NVl5ns1XWiwA31vP-BBmoHcybOEBF3uSnCW7c7qSQ1ZVXGGaAn_3I2XBZZP6Hqrnhkz-QxM0g0B1QHtR32J1Aw&hash=8c618f157421352b7229a0bc7ab86fb58382584a61debd0d012b59529f1f0518",
    "referrer": "",
    "bot_key": "app_bot_0"
}

const data = {
    "taps": 500,
    "time": 1751111111111
};

const boost_data = {
    "type": "turbo"
};

const url = 'https://api.tapswap.club/api';

(async () => {
  const results = await Promise.all(apiKeys.map(async (apiKey, index) => {
    try {
      const login = await fetch(`${url}/account/login`, {
        method: 'POST',
        headers: {
          'authority': 'api.tapswap.club',
          'Origin': 'https://app.tapswap.club',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(loginData)
      });
      const turbo = await fetch(`${url}/player/apply_boost`, {
        method: 'POST',
        headers: {
          'Cache-Id': 'TTrDaXeD',
          'Content-Type': 'application/json',
          'Authorization': apiKey,
          'Origin': 'https://app.tapswap.club',
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Safari/537.36 Edg/138.0.0.0'
        },
        body: JSON.stringify(boost_data)
      });
      const tap = await fetch(`${url}/player/submit_taps`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': apiKey
        },
        body: JSON.stringify(data)
      });

      if (turbo.status >= 200 && turbo.status < 400) console.log(`Applied boost for account ${index + 1}`)
      if (tap.status >= 200 && tap.status < 400) console.log(`Tapped ${data.taps} times for account ${index + 1}`)

      const body = await tap.json();
      if (body) {
        console.log(`✅ Success for account ${index + 1}`, await login.json(), ' and ', body, ' and ', await turbo.json());
      } else {
        console.log(`❌ Error for account ${index + 1}:`)
      }
    } catch (err) {
      console.error(`❌ Error for account ${index + 1}:`, err.message);
    }
  }));
})();