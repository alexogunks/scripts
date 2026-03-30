const puppeteer = require('puppeteer-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');
const tr = require('tor-request'); // For interacting with Tor's control port

puppeteer.use(StealthPlugin());

// Set the password used to generate the hash in `torrc`
tr.TorControlPort.password = 'your_password'; // Replace with your chosen password

const signupUrl = 'https://jssts007.com/#/reg?ic=548281';

// List of accounts to create
const accounts = Array.from({ length: 10 }, (_, i) => ({
  username: `ao${i + 1} ohgee`,
  email: `aoworks${i + 1}@gmail.com`,
  password: `aoboosts${i + 1}#`,
  secpass: `aoboosts${i + 1}#`,
}));

// Function to change the Tor IP address
function changeTorIP() {
  return new Promise((resolve, reject) => {
    tr.renewTorSession((err) => {
      if (err) {
        console.error('Failed to change IP:', err);
        return reject(err);
      }
      console.log('Tor IP changed successfully!');
      resolve();
    });
  });
}

// Launch Puppeteer with Tor's SOCKS5 proxy
async function launchBrowserWithTor() {
  return puppeteer.launch({
    headless: false,
    args: [
      '--proxy-server=socks5://127.0.0.1:9050', // Use Tor's SOCKS5 proxy
    ],
  });
}

// Function to create an account
async function createAccount(account) {
  const browser = await launchBrowserWithTor();
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

// Main function to loop through accounts and change IPs
(async () => {
  for (const account of accounts) {
    try {
      await changeTorIP(); // Change the IP before each account creation
      await createAccount(account);
      await new Promise((resolve) => setTimeout(resolve, 3000)); // Wait 3 seconds between requests
    } catch (error) {
      console.error(`Error processing account ${account.username}:`, error);
    }
  }
})();
