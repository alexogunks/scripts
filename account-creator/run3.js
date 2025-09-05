const puppeteer = require('puppeteer-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');
const randomUserAgent = require('random-useragent');

// Use stealth mode to evade detection
puppeteer.use(StealthPlugin());

// Define SOCKS ports (configured in your `torrc`)
const socksPorts = ['9050', '9052', '9053'];

// List of accounts to create
const accounts = Array.from({ length: 10 }, (_, i) => ({
  username: `ao${i + 1} ohgee`,
  email: `aoworks${i + 1}@gmail.com`,
  password: `aoboosts${i + 1}#`,
  secpass: `aoboosts${i + 1}#`,
}));

// Function to select a random SOCKS port
function getRandomSocksPort() {
  return socksPorts[Math.floor(Math.random() * socksPorts.length)];
}

// Launch browser with a random SOCKS port
async function launchBrowserWithRandomPort() {
  const randomPort = getRandomSocksPort();
  console.log(`Using SOCKS port: ${randomPort}`);

  return puppeteer.launch({
    headless: false,
    args: [
      `--proxy-server=socks5://127.0.0.1:${randomPort}`, // Use random SOCKS proxy
      '--disable-blink-features=AutomationControlled', // Hide Puppeteer traces
    ],
  });
}

// Account creation function
async function createAccount(account) {
  const browser = await launchBrowserWithRandomPort();
  const page = await browser.newPage();

  try {
    // Set random User-Agent to avoid detection
    const userAgent = randomUserAgent.getRandom();
    console.log(`Using User-Agent: ${userAgent}`);
    await page.setUserAgent(userAgent);

    // Set random viewport size
    await page.setViewport({
      width: Math.floor(Math.random() * (1920 - 800) + 800),
      height: Math.floor(Math.random() * (1080 - 600) + 600),
    });

    console.log(`Creating account: ${account.username}, ${account.email}`);

    await page.goto('https://superquantiacs.com/#/register?i=625369', {
      waitUntil: 'networkidle2',
    });

    // Fill in the registration form
    await page.type('input[placeholder="Email"]', account.email, { delay: 100 });
    await page.type('input[placeholder="Login Password"]', account.password, { delay: 100 });
    await page.type('input[placeholder="Security Password"]', account.secpass, { delay: 100 });

    // Submit the form
    await page.waitForSelector('a[class=":uno: base-main-btn flex items-center justify-center important-mt-25px w-full! important-mt-25px w-full!"]');
    await page.click('a[class=":uno: base-main-btn flex items-center justify-center important-mt-25px w-full! important-mt-25px w-full!"]');

    // Wait for navigation to complete
    await page.waitForNavigation({ waitUntil: 'networkidle2', timeout: 5000 });
    console.log(`Successfully created account: ${account.username}`);
  } catch (error) {
    console.error(`Failed to create account ${account.username}:`, error);
  } finally {
    await page.close();
    await browser.close();
  }
}

// Main function to loop through accounts
(async () => {
  for (const account of accounts) {
    try {
      await createAccount(account);

      // Allow user to quit the loop
      process.stdin.setEncoding('utf-8');
      console.log('Type "quit" to exit or press Enter to continue.');

      const input = await new Promise((resolve) => {
        process.stdin.once('data', (data) => resolve(data.trim()));
      });

      if (input.toLowerCase() === 'quit') {
        console.log('Exiting the process...');
        break;
      }

      // Add delay between account creations
      await new Promise((resolve) => setTimeout(resolve, 3000));
    } catch (error) {
      console.error(`Error processing account ${account.username}:`, error);
    }
  }

  process.exit(0);
})();
