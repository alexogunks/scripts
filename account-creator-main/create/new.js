import fs from "fs";
import puppeteer from "puppeteer-extra";
import StealthPlugin from "puppeteer-extra-plugin-stealth";
import pLimit from "p-limit";

puppeteer.use(StealthPlugin());

const signupUrl = "https://earnify.ink/register/ohgeegamby";

const accounts = Array.from({ length: 1000 }, (_, i) => {
  const r1 = Math.floor(Math.random() * 999);
  const r2 = Math.floor(Math.random() * 99);
  const r3 = Math.floor(Math.random() * 999);
  const r4 = Math.floor(Math.random() * 99);
  const r5 = Math.floor(Math.random() * 999);
  const r6 = Math.floor(Math.random() * 99);
  const r7 = Math.floor(Math.random() * 999);

  const crazyRandom = Math.floor(
    r1 * r2 + r3 / r4 * r6 + (((r5 * 100 * r4 * r5 * r1) / 2 * 0.1 * 2000 / r7) * 0.0001)
  );
  const nth = Math.floor(Math.random() * crazyRandom);
  const phone = Math.floor(Math.random() * 99999999);

  return {
    firstname: `ao${nth}ohgee${i}`,
    lastname: `ao${nth}gamby${i}`,
    username: `ao${nth}ohgee${i}`,
    email: `ao${nth}${i}@gmail.com`,
    phone: `080${phone}`,
    password: `aohgee${crazyRandom}n${i}#`,
    secpass: `aohgee${crazyRandom}n${i}#`,
  };
});

let exitFlag = false;

process.stdin.setRawMode(true);
process.stdin.resume();
process.stdin.on('data', (key) => {
  if (key.toString().trim().toLowerCase() === 'q') {
    console.log('Exiting the process...');
    exitFlag = true;
    process.exit(0);
  }
});

async function launchBrowser() {
  try {
    return await puppeteer.launch({
      headless: true,
      args: ["--no-sandbox", "--disable-setuid-sandbox"],
      protocolTimeout: 120000,
    });
  } catch (error) {
    console.error("Failed to launch browser:", error);
    throw error;
  }
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

async function createAccount(browser, account) {
  let context = null;
  let page = null;

  try {
    if (typeof browser.createIncognitoBrowserContext === "function") {
      context = await browser.createIncognitoBrowserContext();
      page = await context.newPage();
    } else {
      page = await browser.newPage();
    }

    console.log(`Creating account: ${account.username}, ${account.email}`);

    await page.goto(signupUrl, { waitUntil: "networkidle2", timeout: 60000 });

    await page.waitForSelector('input[placeholder="First name"]', { timeout: 15000 });
    await page.type('input[placeholder="First name"]', account.firstname, { delay: 100 });

    await page.waitForSelector('input[placeholder="Last name"]', { timeout: 15000 });
    await page.type('input[placeholder="Last name"]', account.lastname, { delay: 100 });

    await page.waitForSelector('input[placeholder="User name"]', { timeout: 15000 });
    await page.type('input[placeholder="User name"]', account.username, { delay: 100 });

    await page.waitForSelector('input[placeholder="Phone"]', { timeout: 15000 });
    await page.type('input[placeholder="Phone"]', account.phone, { delay: 100 });

    await page.waitForSelector('input[placeholder="Email"]', { timeout: 15000 });
    await page.type('input[placeholder="Email"]', account.email, { delay: 100 });
    
    await page.waitForSelector('input[placeholder="Password"]', { timeout: 15000 });
    await page.type('input[placeholder="Password"]', account.password, { delay: 100 });

    await page.waitForSelector('input[placeholder="Confirm password"]', { timeout: 15000 });
    await page.type('input[placeholder="Confirm password"]', account.secpass, { delay: 100 });

    await page.waitForSelector('button[type="submit"]', { timeout: 15000 });
    await page.click('button[type="submit"]');

    try {
      await page.waitForNavigation({ waitUntil: "networkidle2", timeout: 60000 });
    } catch (navErr) {
      console.warn(`Navigation timeout for account ${account.username}. Proceeding...`);
    }

    const loginEmailSelector = 'input[placeholder="Email"]';
    const loginButtonSelector = 'button[type="submit"]';
    if (await page.$(loginEmailSelector)) {
      await page.waitForSelector(loginEmailSelector, { timeout: 15000 });
      await page.waitForSelector(loginButtonSelector, { timeout: 15000 });
      await page.click(loginButtonSelector);
      try {
        await page.waitForNavigation({ waitUntil: "networkidle2", timeout: 120000 });
      } catch (loginNavErr) {
        console.warn(`Post-signup navigation timeout for account ${account.username}.`);
      }
    }

    console.log(`Successfully created account: ${account.username}`);

    fs.appendFileSync(
      "./newaccounts.txt",
      `${account.username} | ${account.email}\n`,
      { encoding: "utf8", flag: "a" }
    );
    fs.appendFileSync(
      "./newpasswords.txt",
      `${account.password}\n`,
      { encoding: "utf8", flag: "a" }
    );
    console.log(`Account details saved for ${account.username}`);

    function accountCount() {
      fs.readFile("./accounts.txt", "utf8", (readErr, data) => {
        if (readErr) {
          return console.error("Error reading accounts.txt:", readErr);
        }
    
        const totalAccounts = data.split("\n").filter(line => line.trim() !== "").length;
    
        fs.writeFile("./total.txt", `Total Accounts Created: ${totalAccounts}`, "utf8", (writeErr) => {
          if (writeErr) {
            return console.error("Error writing total.txt:", writeErr);
          }
          console.log(`Total accounts created:  ${totalAccounts}`);
        });
      });
    }
    accountCount();

  } catch (error) {
    console.error(`Failed to create account ${account.username}:`, error);
  } finally {
    if (page) {
      try {
        await clearSiteData(page);
      } catch (clearError) {
        console.warn(`Error clearing site data for ${account.username}:`, clearError);
      }
      await page.close();
    }
    if (context) await context.close();
  }
}



(async () => {
  const browser = await launchBrowser();

  const MAX_CONCURRENT_ACCOUNTS = 5;
  const limit = pLimit(MAX_CONCURRENT_ACCOUNTS);

  const tasks = accounts.map((account) => limit(() => createAccount(browser, account)));

  await Promise.all(tasks);

  console.log("All accounts processed.");
  await browser.close();
  process.exit(0);
})();
