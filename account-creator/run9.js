const puppeteer = require('puppeteer-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');
const tr = require('tor-request'); // Tor for IP rotation
const readline = require('readline');

puppeteer.use(StealthPlugin()); // Enable stealth mode

// Tor configuration
tr.TorControlPort.password = 'your_password'; // Replace with your actual password

const signupUrl = 'https://superquantiacs.com/#/register?i=625369';
const accounts = Array.from({ length: 10 }, (_, i) => ({
  username: `ao${i + 1} ohgee`,
  email: `aoworks${i + 1}@gmail.com`,
  password: `aoboosts${i + 1}#`,
  secpass: `aoboosts${i + 1}#`,
}));

// Function to handle IP change with retries
function changeTorIP(retries = 3) {
  return new Promise((resolve, reject) => {
    const attemptIPChange = (attempt) => {
      tr.renewTorSession((err) => {
        if (err) {
          console.error(`Failed to change IP. Attempt ${attempt}/${retries}`);
          if (attempt < retries) {
            return setTimeout(() => attemptIPChange(attempt + 1), 2000); // Retry after 2 seconds
          } else {
            return reject(`Failed to change IP after ${retries} attempts: ${err}`);
          }
        }
        console.log('Tor IP changed successfully!');
        resolve();
      });
    };
    attemptIPChange(1);
  });
}

// Launch browser with Tor’s SOCKS5 proxy
async function launchBrowserWithTor() {
  return puppeteer.launch({
    headless: false,
    args: ['--proxy-server=socks5://127.0.0.1:9050'],
  });
}

// Account creation logic
async function createAccount(account) {
  const browser = await launchBrowserWithTor();
  const page = await browser.newPage();

  try {
    console.log(`Creating account: ${account.username}, ${account.email}`);
    await page.goto(signupUrl, { waitUntil: 'networkidle2' });

    // await page.type('input[placeholder="Email"]', account.email);
    // await page.type('input[type="password"]', account.password);
    // await page.type('input[placeholder="Security password"]', account.secpass);

    // await page.waitForSelector('a[class="base-main-btn flex items-center justify-center"]');
    // await page.click('a[class="base-main-btn flex items-center justify-center"]');

    await page.type('input[placeholder="Email"]', account.email, { delay: 100 });
    await page.type('input[placeholder="Login Password"]', account.password, { delay: 100 });
    await page.type('input[placeholder="Security Password"]', account.secpass, { delay: 100 });

    // Submit the form
    await page.waitForSelector('a[class=":uno: base-main-btn flex items-center justify-center important-mt-25px w-full! important-mt-25px w-full!"]');
    await page.click('a[class=":uno: base-main-btn flex items-center justify-center important-mt-25px w-full! important-mt-25px w-full!"]');

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

  for (const account of accounts) {
    try {
      await changeTorIP(); // Change IP before creating an account
      await createAccount(account);
      await new Promise((resolve) => setTimeout(resolve, 3000)); // Wait between registrations
    } catch (error) {
      console.error(`Error processing account ${account.username}:`, error);
    }
  }
})();
