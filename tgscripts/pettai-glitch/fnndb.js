const fetch = (...args) => import('node-fetch').then(({default: fetch}) => fetch(...args));


const endpoint = 'https://fnn02.vip/api_deal/load/create';
const authHeader = 'TERc/9260xgILO4HuXsdtmpazlsaDm79mLvQvXXWe9vrHvBna+Nf4zhVzr5yPsbreYXL678eSWRNCJBuLAQKnMM+hOpUioRPQHKAISr7OY0kdScYiS04Zmr0aSe7n9C3bJNTvDusO+1LF0QFXgVFltltPIVSaIyL+lh3YmwZ714='


const data = {
  deal_id: 7,
  money: Math.floor(Math.random() * (10000 - (-10000) + 1)) + (-10000),
};

const np = {
  "img": "\/upload\/740fb9823be412e1ef5ad4ac1231dd44.png",
  "name": "NFT4",
  "type": "deal",
  "number": "1",
};


async function run () {
  try {
    const response = await fetch(`${endpoint}/`, {
      method: 'POST',
      headers: {
        'Authorization': authHeader,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(data)
    });
    
    const contentType = response.headers.get('content-type');
    const raw = await response.text();
    if (contentType && contentType.includes('application/json')) {
        const json = JSON.parse(raw);
        console.log('✅ JSON:', json);
  
        // if (json.error && /[\u4e00-\u9fa5]/.test(json.error)) {
        //   const translated = await translateChinese(json.error);
        //   console.log('🈶 Translated Error:', translated);
        // }
      } else {
        console.log('⚠️ Not JSON. Raw response:', raw, response.status);
      }
    // console.log('Response:', result);
  } catch (error) {
    console.error('Request failed:', error.message);
  }
};

for (let i = 0; i < 1000; i++) {
    run(i);
}