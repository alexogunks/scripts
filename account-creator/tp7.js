const puppeteer = require('puppeteer-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');
const randomUserAgent = require('random-useragent'); // Ensure installed: npm install random-useragent puppeteer-extra-plugin-stealth puppeteer

puppeteer.use(StealthPlugin());

const signupUrl = 'https://spacewebai.com/#/register?invite=DM5ZAWH';

const accounts = Array.from({ length: 5 }, (_, i) => ({
  username: `ao${i + 1} ohgee`,
  password: `aoboosts${i + 1}#`,
  secpass: `aoboosts${i + 1}#`,
}));

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

// Function to get a temporary email address using 1secmail API
async function getTemporaryEmail() {
  const { default: fetch } = await import('node-fetch'); // Dynamically import node-fetch

  try {
    const response = await fetch('https://www.1secmail.com/api/v1/?action=genRandomMailbox');
    const email = (await response.json())[0];
    console.log(`Generated email: ${email}`);
    return email;
  } catch (error) {
    console.error('Failed to fetch email:', error);
  }
}

// Launch browser with randomized User-Agent and optional proxy
async function launchBrowser(proxy = null) {
  const userAgent = randomUserAgent.getRandom(); // Get a random User-Agent
  const args = [`--user-agent=${userAgent}`];

  if (proxy) {
    args.push(`--proxy-server=${proxy}`);
  }

  return puppeteer.launch({
    headless: false,
    args,
  });
}

// Clear site data
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

// Emulate human-like mouse movements
async function emulateHumanBehavior(page) {
  await page.mouse.move(
    Math.floor(Math.random() * 500),
    Math.floor(Math.random() * 500)
  );
  const delay = Math.random() * 1000 + 500; // Random delay between 500 and 1500 ms
//   await page.waitForTimeout(delay); // Correct usage
}

// Create account
async function createAccount(account, proxy = null) {
  const browser = await launchBrowser(proxy);
  const page = await browser.newPage();

  try {
    console.log(`Creating account: ${account.username}`);
    
    const email = await getTemporaryEmail(); // Generate a temporary email
    console.log(`Using email: ${email}`);
    
    await page.goto(signupUrl, { waitUntil: 'networkidle2' });
    await emulateHumanBehavior(page); // Simulate mouse movement

    await page.type('input[placeholder="Please enter your login email"]', email);

    await page.click('div[class="c-main mr-10 pointer"]');

    // Assuming a function getVerificationCode is defined
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

// Main loop
(async () => {
  const proxy = null; // Optional: Set proxy URL if needed

  for (const account of accounts) {
    if (exitFlag) break;

    try {
      await createAccount(account, proxy);
      await new Promise((resolve) => setTimeout(resolve, 3000));
    } catch (error) {
      console.error(`Error processing account ${account.username}:`, error);
    }
  }

  console.log('All accounts processed or exited.');
  process.exit(0);
})();
