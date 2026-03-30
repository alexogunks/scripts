const puppeteer = require('puppeteer');

// URL of the registration page
const signupUrl = 'https://jssts007.com/#/reg?ic=548281';

// List of accounts to create
const accounts = Array.from({ length: 1000 }, (_, i) => ({
  username: `ao${i + 1} ohgee`,
  email: `aoworks${i + 1}@gmail.com`,
  password: `aoboosts${i + 1}#`,
  secpass: `aoboosts${i + 1}#`,
}));

// 16:3BCB8501F3EF8BC1607A8150FB780501E0F8B3D19E3A34D58ED67716D5

// Function to create an account
async function createAccount(account, browser) {
  const page = await browser.newPage();
  await page.goto(signupUrl, { waitUntil: 'networkidle2' });

  try {
    console.log(`Creating account: ${account.username}, ${account.email}`);

    // Ensure account object has correct values
    if (!account.username || !account.email || !account.password || !account.secpass) {
      throw new Error('Account object has undefined fields');
    }

    // Fill the form fields
    await page.waitForSelector('input[placeholder="Email"]');
    await page.type('input[placeholder="Email"]', account.email);
    
    // await page.waitForSelector('a[href="/register"]');
    // await page.click('a[href="/register"]');

    // await page.waitForSelector('input[name="fullname"]');
    // await page.type('input[name="fullname"]', account.username);

    // await page.waitForSelector('input[name="email"]');
    // await page.type('input[name="email"]', account.email);

    await page.waitForSelector('input[type="password"]');
    await page.type('input[type="password"]', account.password);

    await page.waitForSelector('input[placeholder="Security password"]');
    await page.type('input[placeholder="Security password"]', account.secpass);

    // Click the submit button (ensure correct selector)
    // await page.waitForSelector('button[type="button"]'); // Update the selector if needed
    // await page.click('button[type="button"]');

    await page.waitForSelector('a[class="base-main-btn flex items-center justify-center"]'); // Update the selector if needed
    await page.click('a[class="base-main-btn flex items-center justify-center"]');

    

    // Wait for submission to complete
    await new Promise(resolve => setTimeout(resolve, 3000)); // Wait 3 seconds for form submission

    console.log(`Successfully created account: ${account.username}`);

  } catch (error) {
    console.error(`Failed to create account ${account.username}:`, error);
  } finally {
    // Clear cookies and site data (localStorage and sessionStorage)
    await clearSiteData(page);
    await page.close();
  }
}

// Function to clear cookies and local storage/session storage
async function clearSiteData(page) {
  try {
    // Clear cookies
    const client = await page.target().createCDPSession();
    await client.send('Network.clearBrowserCookies');

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

// Main function to run Puppeteer
(async () => {
  const browser = await puppeteer.launch({ headless: false });  // Set headless to false for debugging

  for (const account of accounts) {
    await createAccount(account, browser);
    await new Promise(resolve => setTimeout(resolve, 2000)); // Wait 2 seconds between account creations
  }

  await browser.close();
})();
