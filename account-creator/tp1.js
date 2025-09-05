const puppeteer = require('puppeteer-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');
const readline = require('readline');

puppeteer.use(StealthPlugin()); // Enable stealth mode

const signupUrl = 'https://jssts007.com/#/reg?ic=548281';

// List of proxies (add more proxies to the array)
const proxies = [
  'http://102.39.232.252@8080',
  'http://1.1.226.191@8080',
  'socks5://proxy3.com:9050',
  'socks5://proxy4.com:9050',
];

// List of accounts to register
const accounts = Array.from({ length: 10 }, (_, i) => ({
  username: `ao${i + 1} ohgee`,
  email: `aoworks${i + 1}@gmail.com`,
  password: `aoboosts${i + 1}#`,
  secpass: `aoboosts${i + 1}#`,
}));

// Function to launch Puppeteer with a specific proxy
async function launchBrowserWithProxy(proxy) {
  console.log(`Launching browser with proxy: ${proxy}`);
  return puppeteer.launch({
    headless: false, // Set to true if you don't need to see the browser
    args: [
      `--proxy-server=${proxy}`, // Use the proxy
      '--no-sandbox',
      '--disable-setuid-sandbox',
    ],
  });
}

// Function to create an account
async function createAccount(account, proxy) {
  const browser = await launchBrowserWithProxy(proxy);
  const page = await browser.newPage();

  try {
    console.log(`Creating account: ${account.username}, ${account.email}`);
    await page.goto(signupUrl, { waitUntil: 'networkidle2' });

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
    await page.close();
    await browser.close();
  }
}

// Function to monitor for user input to quit
function monitorExit() {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  rl.on('line', (input) => {
    if (input.trim().toLowerCase() === 'q') {
      console.log('Exiting the program...');
      process.exit(0);
    }
  });

  console.log('Press "q" and hit Enter to quit at any time.');
}

// Main function to iterate over accounts
(async () => {
  monitorExit(); // Start monitoring for quit input

  for (let i = 0; i < accounts.length; i++) {
    const account = accounts[i];
    const proxy = proxies[i % proxies.length]; // Cycle through the proxies

    try {
      await createAccount(account, proxy); // Create account with the current proxy
      await new Promise((resolve) => setTimeout(resolve, 3000)); // Wait 3 seconds between registrations
    } catch (error) {
      console.error(`Error processing account ${account.username}:`, error);
    }
  }
})();
