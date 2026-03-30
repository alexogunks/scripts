const puppeteer = require('puppeteer-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');
const fetch = (await import('node-fetch')).default;
const randomUserAgent = require('random-useragent'); 

puppeteer.use(StealthPlugin());

const signupUrl = 'https://spacewebai.com/#/register?invite=DM5ZAWH';

const accounts = Array.from({ length: 5 }, (_, i) => ({
  username: `ao${i + 1} ohgee`,
  password: `aoboosts${i + 1}#`,
  secpass: `aoboosts${i + 1}#`,
}));

let useProxy = false; // Set to true if using a proxy
let exitFlag = false;

// Listen for 'q' to exit the script
process.stdin.setRawMode(true);
process.stdin.resume();
process.stdin.on('data', (key) => {
  if (key.toString().trim().toLowerCase() === 'q') {
    console.log('Exiting the process...');
    exitFlag = true;
    process.exit(0);
  }
});

// Generate a temporary email using the 1secmail API
async function getTemporaryEmail() {
  const response = await fetch('https://www.1secmail.com/api/v1/?action=genRandomMailbox');
  const email = (await response.json())[0];
  console.log(`Generated email: ${email}`);
  return email;
}

// Retrieve the verification code from the email inbox
async function getVerificationCode(email) {
  const [user, domain] = email.split('@');
  const url = `https://www.1secmail.com/api/v1/?action=getMessages&login=${user}&domain=${domain}`;

  while (true) {
    const response = await fetch(url);
    const messages = await response.json();

    if (messages.length > 0) {
      const messageId = messages[0].id;
      const messageResponse = await fetch(
        `https://www.1secmail.com/api/v1/?action=readMessage&login=${user}&domain=${domain}&id=${messageId}`
      );
      const message = await messageResponse.json();
      const codeMatch = message.body.match(/\d{6}/); // Assuming 6-digit code
      if (codeMatch) {
        console.log(`Verification code received: ${codeMatch[0]}`);
        return codeMatch[0];
      }
    }

    console.log('Waiting for verification email...');
    await new Promise((resolve) => setTimeout(resolve, 5000)); // Wait 5 seconds before retrying
  }
}

// Launch browser with optional proxy and randomized User-Agent
async function launchBrowser() {
  const userAgent = randomUserAgent.getRandom();
  const args = [`--user-agent=${userAgent}`];

  if (useProxy) {
    args.push('--proxy-server=YOUR_PROXY_URL'); // Replace with your proxy URL
  }

  return puppeteer.launch({ headless: false, args });
}

// Clear site data to avoid detection
async function clearSiteData(page) {
  const client = await page.target().createCDPSession();
  await client.send('Network.clearBrowserCookies');
  await client.send('Network.clearBrowserCache');
  await page.evaluate(() => {
    localStorage.clear();
    sessionStorage.clear();
  });
  console.log('Site data cleared.');
}

// Simulate human-like behavior
async function emulateHumanBehavior(page) {
  await page.mouse.move(Math.floor(Math.random() * 500), Math.floor(Math.random() * 500));
  await page.waitForTimeout(Math.random() * 1000 + 500); // Random delay
}

// Create an account using the generated temporary email
async function createAccount(account) {
  const browser = await launchBrowser();
  const page = await browser.newPage();

  try {
    const email = await getTemporaryEmail();
    console.log(`Creating account: ${account.username}, ${email}`);

    await page.goto(signupUrl, { waitUntil: 'networkidle2' });
    await emulateHumanBehavior(page);

    await page.type('input[placeholder="Please enter your login email"]', email);

    await page.click('div[class="c-main mr-10 pointer"]');

    const verificationCode = await getVerificationCode(email);
    await page.type('input[placeholder="Please enter the verification code"]', verificationCode);

    await page.type('input[placeholder="Please enter your password"]', account.password);
    await page.type('input[placeholder="Please enter the confirmation password"]', account.secpass);

    await page.waitForSelector('div[class="btn btn-lg btn-full circle mt-50"]');
    await page.click('div[class="btn btn-lg btn-full circle mt-50"]');
    


    await page.waitForNavigation({ waitUntil: 'networkidle2', timeout: 5000 });
    console.log(`Successfully created account: ${account.username}`);
  } catch (error) {
    console.error(`Failed to create account ${account.username}:`, error);
  } finally {
    await clearSiteData(page);
    await page.close();
    await browser.close();
  }
}

// Main loop to create multiple accounts
(async () => {
  for (const account of accounts) {
    if (exitFlag) break;

    try {
      await createAccount(account);
      await new Promise((resolve) => setTimeout(resolve, 3000)); // Small delay between accounts
    } catch (error) {
      console.error(`Error processing account ${account.username}:`, error);
    }
  }

  console.log('All accounts processed or exited.');
  process.exit(0);
})();
