const puppeteer = require('puppeteer');

// URL of the registration page
const signupUrl = 'https://www.clickexaprize.buzz/register?_ga=1728651650862';

// List of accounts to create
const accounts = Array.from({ length: 1000 }, (_, i) => ({
  username: `ao${i + 1} ohgee`,
  email: `aoworks${i + 1}@gmail.com`,
  password: `ao@123454${i + 2}`,
}));

// Function to create an account
async function createAccount(account, browser) {
  const page = await browser.newPage();
  await page.goto(signupUrl, { waitUntil: 'networkidle2' });

  try {
    console.log(`Creating account: ${account.username}, ${account.email}`);

    // Make sure the account object has the correct values
    if (!account.username || !account.email || !account.password) {
      throw new Error('Account object has undefined fields');
    }

    // Wait for the username field to appear and fill it
    await page.waitForSelector('input[name="fullname"]');
    await page.type('input[name="fullname"]', account.username);

    // Wait for the email field to appear and fill it
    

    // await page.waitForSelector('input[name="fullname"]');
    // await page.click('input[name="fullname"]');

    // await page.waitForSelector('input[name="email"]');
    // await page.click('input[name="email"]');

    await page.waitForSelector('input[name="email"]');
    await page.type('input[name="email"]', account.email);

    // Wait for the password field to appear and fill it
    await page.waitForSelector('input[name="password"]');
    await page.type('input[name="password"]', account.password);

    await page.waitForSelector('input[name="password_confirmation"]');
    await page.type('input[name="password_confirmation"]', account.password);

    // Click the submit button
    await page.waitForSelector('button[type="button"]');
    await page.click('button[type="button"]');

    // Wait for some time to ensure form submission is complete
    await page.waitForTimeout(3000);

    console.log(`Successfully created account: ${account.username}`);

  } catch (error) {
    console.error(`Failed to create account ${account.username}:`, error);
  } finally {
    await page.close();
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
