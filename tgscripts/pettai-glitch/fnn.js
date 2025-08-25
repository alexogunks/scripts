const fetch = (...args) => import('node-fetch').then(({default: fetch}) => fetch(...args));


const endpoint = 'https://fnn02.vip/api_crypto/crypto-exchange/balance';
const authHeader = 'TERc/9260xgILO4HuXsdtru5hUy4NZjhpkzd/DhE6dFVY5F/OeFmjKcyxdgfTmEri7QVcxVVCuCp9Gg95K1nIlSKv4Rl3pyHzkJR0ji1yw2Nqzp0srkvQoGkRHPBb8ydi99aFnkR00PeDAqHjmTAHY2mdp9pgnfKrAo3Aa7BwIU='

const money = {
    toJSON: () => 100,
    valueOf: () => -100,
    toString: () => "-100"
  };
  

const data = {
  deal_id: 7,
  money: -100,
};

const payload = {
    "token": "BTC",
    "number": "0.0015",
    "balance": 0.002
}

const loginPayload = {
    "email": "thecreeptoguy@gmail.com",
    "login_pwd": "Creeper123."
}

const rawBody = `{
    "deal_id": 7,
    "money": -100,
    "money": 100
  }`;
    

(async () => {
  try {
    const loginResponse = await fetch("https://fnn02.vip/common/user/login-by-pwd", {
      method: 'POST',
      headers: {
        'Authorization': authHeader,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(loginPayload)
    });

    console.log(await loginResponse.json())

    const response = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Authorization': authHeader,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(payload)
    });
    
    const contentType = response.headers.get('content-type');
    const raw = await response.text();
    if (contentType && contentType.includes('application/json')) {
        const json = JSON.parse(raw);
        console.log('✅ JSON:', json);
        // console.log(await response.json());
  
        // if (json.error && /[\u4e00-\u9fa5]/.test(json.error)) {
        //   const translated = await translateChinese(json.error);
        //   console.log('🈶 Translated Error:', translated);
        // }
      } else {
        console.log('⚠️ Not JSON. Raw response:', raw);
      }
    // console.log('Response:', result);
  } catch (error) {
    console.error('Request failed:', error.message);
  }
})();