import fs from "node:fs";
import puppeteer from "puppeteer-extra";
import StealthPlugin from "puppeteer-extra-plugin-stealth";
import { spawn } from "child_process";

puppeteer.use(StealthPlugin());

const loginUrl = "https://pixelexchange.xyz/login.html";

async function launchBrowser() {
  return puppeteer.launch({
    headless: false,
    args: ["--no-sandbox", "--disable-setuid-sandbox"],
  });
}

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

async function loginAccount(account) {
  const browser = await launchBrowser();
  const page = await browser.newPage();

  try {
    console.log(`Logging in as: ${account.username} (${account.email})`);
    await page.goto(loginUrl, { waitUntil: "networkidle2" });

    await page.waitForSelector('input[placeholder="Email"]');
    await page.type('input[placeholder="Email"]', account.email);

    await page.waitForSelector('input[placeholder="Password"]');
    await page.type('input[placeholder="Password"]', account.password);

    await page.waitForSelector('button[type="submit"]');
    await page.click('button[type="submit"]');

    try {
      await page.waitForNavigation({ waitUntil: "networkidle2", timeout: 5000 });
    } catch (navErr) {
      console.warn(`Navigation timeout for ${account.username}. Continuing...`);
    }
    
    console.log(`Successfully logged in: ${account.username}`);

    await clearSiteData(page);

    restartScript();
    
  } catch (error) {
    console.error(`Failed to log in: ${account.username}`, error);
  } finally {
    await page.close();
    await browser.close();
  }
}

const testAccount = {
  username: "testUser",
  email: "test@example.com",
  password: "password123",
};

loginAccount(testAccount);

function restartScript() {
  const child = spawn(process.argv[0], process.argv.slice(1), {
    stdio: "inherit",
  });
  
  child.on("close", (code) => {
    process.exit(code);
  });
  
  console.log("Script restarting...");
  process.exit();
}
