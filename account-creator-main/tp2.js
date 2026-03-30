const puppeteer = require('puppeteer-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');
const randomUserAgent = require('random-useragent'); // Install this package

puppeteer.use(StealthPlugin());

const signupUrl = 'https://jssts007.com/#/reg?ic=548281';

// Replace with your list of free proxies (IP:PORT format)
const proxyList = [
  '131.153.187.5:50689',
  '1.94.31.35:8888',
  '136.226.255.23:10220',
];

// Accounts to create
const accounts = Array.from({ length: 5 }, (_, i) => ({
  username: `ao${i + 1} ohgee`,
  email: `aoworks${i + 1}@gmail.com`,
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

// Select a random proxy from the list
function getRandomProxy() {
  return proxyList[Math.floor(Math.random() * proxyList.length)];
}

// Launch browser with randomized User-Agent and Proxy
async function launchBrowserWithProxy(proxy) {
  const userAgent = randomUserAgent.getRandom();
  return puppeteer.launch({
    headless: false,
    args: [
      `--proxy-server=${proxy}`, // Use the proxy
      `--user-agent=${userAgent}`,
    ],
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
  await page.waitForTimeout(Math.random() * 1000 + 500); // Random delay
}

// Create account
async function createAccount(account) {
  const proxy = getRandomProxy(); // Get a proxy from the list
  const browser = await launchBrowserWithProxy(proxy);
  const page = await browser.newPage();

  try {
    console.log(`Creating account: ${account.username}, ${account.email}`);
    await page.goto(signupUrl, { waitUntil: 'networkidle2' });

    await emulateHumanBehavior(page); // Simulate mouse movement

    await page.type('input[placeholder="Email"]', account.email);
    await page.type('input[type="password"]', account.password);
    await page.type('input[placeholder="Security password"]', account.secpass);

    await page.waitForSelector('a[class="base-main-btn flex items-center justify-center"]');
    await page.click('a[class="base-main-btn flex items-center justify-center"]');

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
  for (const account of accounts) {
    if (exitFlag) break;

    try {
      console.log(`Using proxy: ${getRandomProxy()}`);
      await createAccount(account);
      await new Promise((resolve) => setTimeout(resolve, 3000)); // Wait between accounts
    } catch (error) {
      console.error(`Error processing account ${account.username}:`, error);
    }
  }

  console.log('All accounts processed or exited.');
  process.exit(0);
})();
