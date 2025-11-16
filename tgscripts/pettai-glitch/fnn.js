const fetch = (...args) => import('node-fetch').then(({default: fetch}) => fetch(...args));


const endpoint = 'https://aiquantify.link/Auth/authentication.php';
const authHeader = 'TERc/9260xgILO4HuXsdtru5hUy4NZjhpkzd/DhE6dFVY5F/OeFmjKcyxdgfTmEri7QVcxVVCuCp9Gg95K1nIlSKv4Rl3pyHzkJR0ji1yw2Nqzp0srkvQoGkRHPBb8ydi99aFnkR00PeDAqHjmTAHY2mdp9pgnfKrAo3Aa7BwIU='

const payload = {
  "user_id": 7022281670,
  "first_name": "Alex",
  "last_name": "",
  "username": "alexohgee",
  "lang": "en"
}
    

const spam = async () => {
  try {
    const response = await fetch(endpoint, {
      method: 'POST',
      headers: {
        // 'Authorization': authHeader,
        'Content-Type': 'application/json',
        'Cookie': 'PHPSESSID=mvbn2c0lsfnnjs48kbhpsjgkut'
      },
      body: JSON.stringify(payload)
    });
    
    const contentType = response.headers.get('content-type');
    const raw = await response.text();
    if (contentType && contentType.includes('application/json')) {
        const json = JSON.parse(raw);
        console.log('✅ JSON:', json);
      } else {
        console.log('⚠️ Not JSON. Raw response:', raw);
      }
  } catch (error) {
    console.error('Request failed:', error.message);
  }
};

(async () => {
  for (let i = 0; i < 1000; i++) {
    spam(i);
  }
})();