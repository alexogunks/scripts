const puppeteer = require('puppeteer-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');
const tr = require('tor-request');
const randomUserAgent = require('random-useragent'); // Install this package

puppeteer.use(StealthPlugin());

const signupUrl = 'https://jssts007.com/#/reg?ic=548281';

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

// Change Tor IP
function changeTorIP() {
  return new Promise((resolve, reject) => {
    tr.renewTorSession((err) => {
      if (err) return reject('Failed to change IP:', err);
      console.log('Tor IP changed successfully!');
      resolve();
    });
  });
}

// Launch browser with randomized User-Agent and Tor SOCKS5 proxy
async function launchBrowserWithTor() {
  const userAgent = randomUserAgent.getRandom(); // Get a random User-Agent
  return puppeteer.launch({
    headless: false,
    args: [
      '--proxy-server=socks5://127.0.0.1:9050',
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
  const browser = await launchBrowserWithTor();
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
      await changeTorIP();
      await createAccount(account);
      await new Promise((resolve) => setTimeout(resolve, 3000));
    } catch (error) {
      console.error(`Error processing account ${account.username}:`, error);
    }
  }

  console.log('All accounts processed or exited.');
  process.exit(0);
})();
