const fetch = (...args) => import('node-fetch').then(({default: fetch}) => fetch(...args));
import WebSocket from 'ws';

const ws = new WebSocket('wss://tonblitzapi.bitsapiens.io/ws?userId=13385');

ws.on('open', () => {
  console.log('✅ Connected');

  if (!ws) {
    console.error("No WebSocket found");
  } else {
    let clicksToSend = 99999999;
    let delay = 20000000000 / clicksToSend;
  
    let i = 0;
    let interval = setInterval(() => {
      if (i >= clicksToSend) {
        clearInterval(interval);
        return;
      }
  
      let message = {
        type: "batchClicks",
        clicks: 999999999999999,
        clickData: {
          position: {
            x: 200 + Math.floor(Math.random() * 5),
            y: 300 + Math.floor(Math.random() * 5)
          },
          deviceInfo: navigator.userAgent
        }
      };
  
      ws.send(JSON.stringify(message));
      i++;
    }, delay);
  }  
});

ws.on('message', (data) => {
  console.log('📨 Received:', data.toString());
});

// ws.on('close', () => {
//   console.log('🔒 Connection closed');
// });

ws.on('error', (err) => {
  console.error('❌ Error:', err);
});


const apiKeys = [
    "541dfbd3-fb5d-434c-a04d-811b8e5c1f13",
];

const spinData = {userId: 13385}

const data = {
    userId: 13385,
    rewardType: 'BONUS_CARD'
};

const url = 'https://tonblitzapi.bitsapiens.io/api/users';

(async () => {
  const results = await Promise.all(apiKeys.map(async (apiKey, index) => {
    try {
      const buySpin = await fetch(`${url}/buy-spin`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Api-Key': apiKey
        },
        body: JSON.stringify(spinData)
      });

      if (buySpin.status >= 200 && buySpin.status < 400) console.log(`Spin bought for account ${index + 1}`)

      const res = await fetch(`${url}/reward`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'X-Api-Key': apiKey
          },
          body: JSON.stringify(data)
      });
      const body = await res.json();
      if (body) {
        console.log(`✅ Success for account ${index + 1}`, body);
      } else {
        console.log(`❌ Error for account ${index + 1}:`)
      }
    } catch (err) {
      console.error(`❌ Error for account ${index + 1}:`, err.message);
    }
  }));
})();