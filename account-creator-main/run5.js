const puppeteer = require('puppeteer-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');

puppeteer.use(StealthPlugin());

const signupUrl = 'https://jssts007.com/#/reg?ic=548281';

const accounts = Array.from({ length: 10 }, (_, i) => ({
  username: `ao${i + 1} ohgee`,
  email: `aoworks${i + 1}@gmail.com`,
  password: `aoboosts${i + 1}#`,
  secpass: `aoboosts${i + 1}#`,
}));

async function launchBrowser() {
  return puppeteer.launch({
    headless: false, // Set to true in production
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
  });
}

// Function to clear site data (cookies, cache, local storage, session storage)
async function clearSiteData(page) {
  const client = await page.target().createCDPSession();

  try {
    // Clear cookies
    await client.send('Network.clearBrowserCookies');

    // Clear cache
    await client.send('Network.clearBrowserCache');

    // Clear local storage and session storage
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

    await page.type('input[placeholder="Email"]', account.email);
    await page.type('input[type="password"]', account.password);
    await page.type('input[placeholder="Security password"]', account.secpass);

    await page.waitForSelector('a[class="base-main-btn flex items-center justify-center"]');
    await page.click('a[class="base-main-btn flex items-center justify-center"]');

    // await page.waitForNavigation({ waitUntil: 'networkidle2', timeout: 5000 });

    console.log(`Successfully created account: ${account.username}`);
  } catch (error) {
    console.error(`Failed to create account ${account.username}:`, error);
  } finally {
    await clearSiteData(page); // Clear site data after account creation
    await page.close();
    await browser.close();
  }
}

(async () => {
  for (const account of accounts) {
    try {
      await createAccount(account);

      console.log('Type "q" to exit or press Enter to continue.');
      const input = await new Promise((resolve) => {
        process.stdin.once('data', (data) => resolve(data.toString().trim()));
      });

      if (input.toLowerCase() === 'q') {
        console.log('Exiting the process...');
        break;
      }

      await new Promise((resolve) => setTimeout(resolve, 3000));
    } catch (error) {
      console.error(`Error processing account ${account.username}:`, error);
    }
  }

  process.exit(0);
})();
