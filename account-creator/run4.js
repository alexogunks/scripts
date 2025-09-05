const puppeteer = require('puppeteer-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');
const RecaptchaPlugin = require('puppeteer-extra-plugin-recaptcha'); // Captcha solver plugin
const randomUserAgent = require('random-useragent');

// Replace with your 2Captcha API key
const API_KEY = 'your_2captcha_api_key';

puppeteer.use(StealthPlugin());
puppeteer.use(
  RecaptchaPlugin({
    provider: { id: '2captcha', token: API_KEY }, // Captcha API provider
    visualFeedback: true, // Show progress on page (useful for debugging)
  })
);

// Accounts to create
const accounts = Array.from({ length: 10 }, (_, i) => ({
  username: `ao${i + 1} ohgee`,
  email: `aoworks${i + 1}@gmail.com`,
  password: `aoboosts${i + 1}#`,
  secpass: `aoboosts${i + 1}#`,
}));

async function launchBrowser() {
  return puppeteer.launch({
    headless: false,
    args: ['--disable-blink-features=AutomationControlled'],
  });
}

async function createAccount(account) {
  const browser = await launchBrowser();
  const page = await browser.newPage();

  try {
    const userAgent = randomUserAgent.getRandom();
    await page.setUserAgent(userAgent);

    await page.setViewport({
      width: Math.floor(Math.random() * (1920 - 800) + 800),
      height: Math.floor(Math.random() * (1080 - 600) + 600),
    });

    console.log(`Creating account: ${account.username}, ${account.email}`);
    await page.goto('https://jssts007.com/#/reg?ic=548281', {
      waitUntil: 'networkidle2',
    });

    // Solve reCAPTCHA if present
    await page.solveRecaptchas();

    await page.waitForSelector('input[placeholder="Email"]');
    await page.type('input[placeholder="Email"]', account.email, { delay: 100 });
    await page.type('input[type="password"]', account.password, { delay: 100 });
    await page.type('input[placeholder="Security password"]', account.secpass, { delay: 100 });

    await page.waitForSelector('a[class="base-main-btn flex items-center justify-center"]');
    await page.click('a[class="base-main-btn flex items-center justify-center"]');

  
    console.log(`Successfully created account: ${account.username}`);
    // await page.waitForNavigation({ waitUntil: 'networkidle2', timeout: 100000 });

  } catch (error) {
    console.error(`Failed to create account ${account.username}:`, error);
  } finally {
    await page.close();
    await browser.close();
  }
}

(async () => {
  for (const account of accounts) {
    try {
      await createAccount(account);

      console.log('Type "quit" to exit or press Enter to continue.');
      const input = await new Promise((resolve) => {
        process.stdin.once('data', (data) => resolve(data.toString().trim()));
      });
      

      if (input.toLowerCase() === 'quit') {
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
