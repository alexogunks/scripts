import fs from "fs";
import puppeteer from "puppeteer-extra";
import StealthPlugin from "puppeteer-extra-plugin-stealth";

puppeteer.use(StealthPlugin());

const signupUrl = "https://pixelexchange.xyz/signup.html?ref=thecreeptoguy";

const accounts = Array.from({ length: 1000 }, (_, i) => {
  const r1 = Math.floor(Math.random() * 1000);
  const r2 = Math.floor(Math.random() * 1000);
  const r3 = Math.floor(Math.random() * 1000);
  const r4 = Math.floor(Math.random() * 100);
  const r5 = Math.floor(Math.random() * 1000);
  
  const crazyRandom = Math.floor(r1 + r2 + r3 + r4 + r5 * 100 * r4 * r5 * r1/2 * 0.1 * 2000);
  
  return {
    username: `a${r1}${r2}ohgee${i}`,
    email: `ao${r1}${r1 * r5}${r2}${r3}${r4}${r5}${r5 + r3}${i}@gmail.com`,
    password: `aohgee${crazyRandom}#`,
    secpass: `aohgee${crazyRandom}#`,
  };
});


let exitFlag = false;

process.stdin.setRawMode(true);
process.stdin.resume();
process.stdin.on("data", (key) => {
  if (key.toString().trim().toLowerCase() === "q") {
    console.log("Exiting the process...");
    exitFlag = true;
    process.exit(0);
  }
});

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

async function createAccount(account) {
  const browser = await launchBrowser();
  const page = await browser.newPage();

  try {
    console.log(`Creating account: ${account.username}, ${account.email}`);
    await page.goto(signupUrl, { waitUntil: "networkidle2" });

    await page.waitForSelector('input[placeholder="Email"]');
    await page.type('input[placeholder="Email"]', account.email);

    await page.waitForSelector('input[placeholder="Username"]');
    await page.type('input[placeholder="Username"]', account.username);

    await page.type('input[placeholder="Password"]', account.password);
    await page.type('input[placeholder="Confirm Password"]', account.secpass);

    await page.waitForSelector('button[type="submit"]');
    await page.click('button[type="submit"]');

    await page.waitForSelector('button[type="submit"]');
    await page.click('button[type="submit"]');

    // Wrap waitForNavigation in a try/catch block
    try {
      // Increase the timeout if needed (here set to 5000ms)
      await page.waitForNavigation({ waitUntil: "networkidle2", timeout: 7000 });
    } catch (navErr) {
      console.warn(`Navigation timeout for account ${account.username}. Continuing...`);
    }

    console.log(`Successfully created account: ${account.username}`);

    // Logging to files with explicit paths and options
    try {
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
    } catch (fileError) {
      console.error("Error writing to file:", fileError);
    }
  } catch (error) {
    console.error(`Failed to create account ${account.username}:`, error);
  } finally {
    try {
      await clearSiteData(page);
    } catch (clearError) {
      console.warn(`Error clearing site data for ${account.username}:`, clearError);
    }
    await page.close();
    await browser.close();
  }
}


(async () => {
  for (const account of accounts) {
    if (exitFlag) break;

    try {
      await createAccount(account);
      await new Promise((resolve) => setTimeout(resolve, 200));
    } catch (error) {
      console.error(`Error processing account ${account.username}:`, error);
    }
  }

  console.log("All accounts processed or exited.");
  process.exit(0);
})();
