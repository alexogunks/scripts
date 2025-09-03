// const puppeteer = require('puppeteer-extra');
// const StealthPlugin = require('puppeteer-extra-plugin-stealth');
// const randomUserAgent = require('random-useragent');
// const tr = require('tor-request');

// puppeteer.use(StealthPlugin());

// tr.TorControlPort.password = 'your_password'; 

// function randomDelay(min, max) {
//   return new Promise((resolve) => setTimeout(resolve, Math.random() * (max - min) + min));
// }

// async function createAccount(account) {
//   const browser = await puppeteer.launch({
//     headless: false,
//     args: ['--proxy-server=socks5://127.0.0.1:9050'],
//   });
//   const page = await browser.newPage();

//   try {
//     const userAgent = randomUserAgent.getRandom();
//     await page.setUserAgent(userAgent);
//     await page.setExtraHTTPHeaders({ 'Accept-Language': 'en-US,en;q=0.9' });

//     console.log(`Creating account: ${account.username}`);
//     await page.goto('https://jssts007.com/#/reg?ic=548281', { waitUntil: 'networkidle2' });

//     await page.type('input[placeholder="Email"]', account.email, { delay: 100 });
//     await page.type('input[type="password"]', account.password, { delay: 120 });
//     await page.type('input[placeholder="Security password"]', account.secpass, { delay: 120 });

//     await page.waitForSelector('a[class="base-main-btn flex items-center justify-center"]');
//     await page.click('a[class="base-main-btn flex items-center justify-center"]');

//     await page.waitForNavigation({ waitUntil: 'networkidle2' });
//     console.log(`Successfully created account: ${account.username}`);
//   } catch (error) {
//     console.error(`Failed to create account ${account.username}:`, error);
//   } finally {
//     await page.close();
//     await browser.close();
//   }
// }

// (async () => {
//   for (const account of accounts) {
//     try {
//       await changeTorIP();
//       await createAccount(account);
//       await randomDelay(3000, 7000); // Random delay between 3-7 seconds
//     } catch (error) {
//       console.error(`Error processing account ${account.username}:`, error);
//     }
//   }
// })();




const puppeteer = require('puppeteer-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');
const randomUserAgent = require('random-useragent'); 
const tr = require('tor-request'); // Tor request library

// Use Puppeteer stealth plugin to avoid detection
puppeteer.use(StealthPlugin());

// Set the Tor ControlPort password
tr.TorControlPort.password = 'your_password'; // Replace with your password

// Signup URL
const signupUrl = 'https://jssts007.com/#/reg?ic=548281';

// Array of accounts to create
const accounts = Array.from({ length: 10 }, (_, i) => ({
  username: `ao${i + 1} ohgee`,
  email: `aoworks${i + 1}@gmail.com`,
  password: `aoboosts${i + 1}#`,
  secpass: `aoboosts${i + 1}#`,
}));

// Helper function to change Tor IP
function changeTorIP() {
  return new Promise((resolve, reject) => {
    tr.renewTorSession((err) => {
      if (err) return reject(`Failed to change IP: ${err}`);
      console.log('Tor IP changed successfully!');
      resolve();
    });
  });
}

// Function to launch Puppeteer with Tor proxy
async function launchBrowserWithTor() {
  return puppeteer.launch({
    headless: false, // Set to true if you don't need to see the browser
    args: ['--proxy-server=socks5://127.0.0.1:9050'], // Tor SOCKS5 proxy
  });
}

// Function to create an account
async function createAccount(account) {
  const browser = await launchBrowserWithTor();
  const page = await browser.newPage();

  try {
    const userAgent = randomUserAgent.getRandom(); // Random User-Agent
    await page.setUserAgent(userAgent);
    await page.setExtraHTTPHeaders({ 'Accept-Language': 'en-US,en;q=0.9' });

    console.log(`Creating account: ${account.username}`);
    await page.goto(signupUrl, { waitUntil: 'networkidle2' });

    await page.type('input[placeholder="Email"]', account.email, { delay: 100 });
    await page.type('input[type="password"]', account.password, { delay: 120 });
    await page.type('input[placeholder="Security password"]', account.secpass, { delay: 120 });

    await page.waitForSelector('a[class="base-main-btn flex items-center justify-center"]');
    await page.click('a[class="base-main-btn flex items-center justify-center"]');

    await page.waitForNavigation({ waitUntil: 'networkidle2' });
    console.log(`Successfully created account: ${account.username}`);
  } catch (error) {
    console.error(`Failed to create account ${account.username}:`, error);
  } finally {
    await page.close();
    await browser.close();
  }
}

// Main function to run the account creation process
(async () => {
  for (const account of accounts) {
    try {
      await changeTorIP(); // Change IP before each account creation
      await createAccount(account); // Create account
      await new Promise((resolve) => setTimeout(resolve, 3000)); // Wait between requests
    } catch (error) {
      console.error(`Error processing account ${account.username}:`, error);
    }
  }
})();

