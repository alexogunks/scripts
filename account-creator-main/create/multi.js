import fs from "fs";
import puppeteer from "puppeteer-extra";
import StealthPlugin from "puppeteer-extra-plugin-stealth";
import pLimit from "p-limit";

puppeteer.use(StealthPlugin());

const signupUrl = "https://pixelexchange.xyz/signup.html?ref=tcgupd";

// Generate accounts with randomized details
const accounts = Array.from({ length: 1000 }, (_, i) => {
  const r1 = Math.floor(Math.random() * 1000);
  const r2 = Math.floor(Math.random() * 10);
  const r3 = Math.floor(Math.random() * 1000);
  const r4 = Math.floor(Math.random() * 10000);
  const r5 = Math.floor(Math.random() * 1000);
  const r6 = Math.floor(Math.random() * 9999);

  const crazyRandom = Math.floor(r1 + r2 + r3 + r4 + r5 * 100 * r4 * r5 * r1 / 2 * 0.1 * 2000);
  const nth = Math.floor(Math.random() * crazyRandom);

  return {
    username: `a${r1}${r2}${crazyRandom}${nth}ohgee${i}`,
    email: `ao${r1}${r6 * r3}${nth}${r2}${r3}${r4}${r5}${r1 + r3}${nth}${i}@gmail.com`,
    password: `aohgee${crazyRandom}#`,
    secpass: `aohgee${crazyRandom}#`,
  };
});

// Launch a single browser instance with an increased protocol timeout
async function launchBrowser() {
  return puppeteer.launch({
    headless: "new",
    args: ["--no-sandbox", "--disable-setuid-sandbox"],
    protocolTimeout: 120000, // Increase protocol timeout to 120 seconds
    // slowMo: 50, // Optional: slow down operations to ease CDP pressure
  });
}

// Clear cookies, cache, and storage on the given page
async function clearSiteData(page) {
  const client = await page.target().createCDPSession();
  try {
    await client.send("Network.clearBrowserCookies");
    await client.send("Network.clearBrowserCache");
    await page.evaluate(() => {
      localStorage.clear();
      sessionStorage.clear();
    });
    console.log("Site data cleared successfully.");
  } catch (error) {
    console.error("Failed to clear site data:", error);
  }
}

// Create a single account. Use an incognito context if available; otherwise, fall back to a normal page.
async function createAccount(browser, account) {
  let context = null;
  let page = null;

  if (typeof browser.createIncognitoBrowserContext === "function") {
    context = await browser.createIncognitoBrowserContext();
    page = await context.newPage();
  } else {
    page = await browser.newPage();
  }

  try {
    console.log(`Creating account: ${account.username}, ${account.email}`);
    // Increase timeout to 60 seconds for slow-loading pages
    await page.goto(signupUrl, { waitUntil: "networkidle2", timeout: 60000 });

    await page.waitForSelector('input[placeholder="Email"]');
    await page.type('input[placeholder="Email"]', account.email);

    await page.waitForSelector('input[placeholder="Username"]');
    await page.type('input[placeholder="Username"]', account.username);

    await page.waitForSelector('input[placeholder="Password"]');
    await page.type('input[placeholder="Password"]', account.password);

    await page.waitForSelector('input[placeholder="Confirm Password"]');
    await page.type('input[placeholder="Confirm Password"]', account.secpass);

    await page.waitForSelector('button[type="submit"]');
    await page.click('button[type="submit"]');

    await page.waitForSelector('input[placeholder="Email or Username"]');
    await page.waitForSelector('button[type="submit"]');
    await page.click('button[type="submit"]');

    // Increase the navigation timeout to 15 seconds after submission
    try {
      await page.waitForNavigation({ waitUntil: "networkidle2", timeout: 1500000 });
    } catch (navErr) {
      console.warn(`Navigation timeout for account ${account.username}. Continuing...`);
    }

    console.log(`Successfully created account: ${account.username}`);

    fs.appendFileSync(
      "./accounts.txt",
      `${account.username} | ${account.email}\n`,
      { encoding: "utf8", flag: "a" }
    );
    fs.appendFileSync(
      "./passwords.txt",
      `${account.password}\n`,
      { encoding: "utf8", flag: "a" }
    );
    console.log(`Account details saved for ${account.username}`);
  } catch (error) {
    console.error(`Failed to create account ${account.username}:`, error);
  } finally {
    try {
      await clearSiteData(page);
    } catch (clearError) {
      console.warn(`Error clearing site data for ${account.username}:`, clearError);
    }
    await page.close();
    if (context) await context.close();
  }
}

// Main function: launch one browser and process accounts with controlled concurrency
(async () => {
  const browser = await launchBrowser();

  // Lower concurrency to reduce pressure on CDP (adjust based on your system)
  const MAX_CONCURRENT_ACCOUNTS = 10000;
  const limit = pLimit(MAX_CONCURRENT_ACCOUNTS);

  // Map each account to a limited concurrent task.
  const tasks = accounts.map(account => limit(() => createAccount(browser, account)));

  await Promise.all(tasks);

  console.log("All accounts processed.");
  await browser.close();
  process.exit(0);
})();
