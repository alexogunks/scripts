import WebSocket from 'ws';

const ws = new WebSocket('wss://petbot-monorepo-websocket-333713154917.europe-west1.run.app/');

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
  console.error('❌ Error:', err.message);
});