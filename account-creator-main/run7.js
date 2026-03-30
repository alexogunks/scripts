const puppeteer = require('puppeteer-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');
const tr = require('tor-request'); // Tor integration to rotate IPs
puppeteer.use(StealthPlugin());

const signupUrl = 'https://jssts007.com/#/reg?ic=548281';

const accounts = Array.from({ length: 5 }, (_, i) => ({
  username: `ao${i + 1} ohgee`,
  email: `aoworks${i + 1}@gmail.com`,
  password: `aoboosts${i + 1}#`,
  secpass: `aoboosts${i + 1}#`,
}));

let exitFlag = false; // Flag to track if 'q' is pressed

// Configure Tor password (replace with your generated password)
tr.TorControlPort.password = 'your_password'; // Same as in torrc

// Function to listen for 'q' input to exit the loop
process.stdin.setRawMode(true);
process.stdin.resume();
process.stdin.on('data', (key) => {
  if (key.toString().trim().toLowerCase() === 'q') {
    console.log('Exiting the process...');
    exitFlag = true;
    process.exit(0); // Exit the script
  }
});

// Function to change Tor IP
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
    args: ['--proxy-server=socks5://127.0.0.1:9050'],
  });
}

// Clear cookies and storage after each account
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

// Create account function
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
    await clearSiteData(page);
    await page.close();
    await browser.close();
  }
}

// Main loop to register accounts and rotate IPs
(async () => {
  for (const account of accounts) {
    if (exitFlag) break; // Exit loop if 'q' is pressed

    try {
      await changeTorIP(); // Change IP before each registration
      await createAccount(account);
      await new Promise((resolve) => setTimeout(resolve, 3000)); // Wait 3 seconds
    } catch (error) {
      console.error(`Error processing account ${account.username}:`, error);
    }
  }

  console.log('All accounts processed or exited.');
  process.exit(0); // Exit the process
})();
