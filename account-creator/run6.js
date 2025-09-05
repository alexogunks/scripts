const puppeteer = require('puppeteer-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');

puppeteer.use(StealthPlugin());

const signupUrl = 'https://pixelexchange.xyz/signup.html?ref=thecreeptoguy';

const accounts = Array.from({ length: 1000 }, (_, i) => ({
  username: `aohgee${i + 0}`,
  email: `aohgee${i + 0}@gmail.com`,
  password: `aohgee${i + 0}#`,
  secpass: `aohgee${i + 0}#`,
}));

let exitFlag = false;

process.stdin.setRawMode(true);
process.stdin.resume();
process.stdin.on('data', (key) => {
  if (key.toString().trim().toLowerCase() === 'q') {
    console.log('Exiting the process...');
    exitFlag = true;
    process.exit(0);
  }
});

async function launchBrowser() {
  return puppeteer.launch({
    headless: false,
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
  });
}

async function clearSiteData(page) {
  const client = await page.target().createCDPSession();

  try {
    await client.send('Network.clearBrowserCookies');
    await client.send('Network.clearBrowserCache');
    await page.evaluate(() => {
      localStorage.clear();
      sessionStorage.clear();
    });
    console.log('Site data cleared successfully.');
  } catch (error) {
    console.error('Failed to clear site data:', error);
  }
}

async function createAccount(account) {
  const browser = await launchBrowser();
  const page = await browser.newPage();

  try {
    console.log(`Creating account: ${account.username}, ${account.email}`);
    await page.goto(signupUrl, { waitUntil: 'networkidle2' });

    await page.waitForSelector('input[placeholder="Email"]');
    await page.type('input[placeholder="Email"]', account.email);

    await page.waitForSelector('input[placeholder="Username"]');
    await page.type('input[placeholder="Username"]', account.username);

    await page.type('input[placeholder="Password"]', account.password);

    await page.type('input[placeholder="Confirm Password"]', account.secpass);

    await page.waitForSelector('button[type="submit"]');
    await page.click('button[type="submit"]');

    await page.waitForNavigation({ waitUntil: 'networkidle2', timeout: 2000 });
    console.log(`Successfully created account: ${account.username}`);
  } catch (error) {
    console.error(`Failed to create account ${account.username}:`, error);
  } finally {
    await clearSiteData(page);
    await page.close();
    await browser.close();
  }
}

(async () => {
  for (const account of accounts) {
    if (exitFlag) break;

    try {
      await createAccount(account);
      await new Promise((resolve) => setTimeout(resolve, 200));
    } catch (error) {
      console.error(`Error processing account ${account.username}:`, error);
    }
  }

  console.log('All accounts processed or exited.');
  process.exit(0);
})();
