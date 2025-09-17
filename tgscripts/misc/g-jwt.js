// g-jwt.js
import puppeteer from "puppeteer";

const APP_URL = "https://app.pett.ai";
const EMAIL   = "ymykfa@mailto.plus";

function sleep(ms) {
  return new Promise(r => setTimeout(r, ms));
}

(async () => {
  const browser = await puppeteer.launch({
    headless: false,          // visible browser for captcha/OTP
    defaultViewport: null,
  });

  const [page] = await browser.pages();
  await page.goto(APP_URL, { waitUntil: "networkidle2" });

  // adjust selectors to match Pett.ai login form
  await page.waitForSelector('input[type="email"]');
  await page.type('input[type="email"]', EMAIL, { delay: 50 });
  await page.click('button[class="StyledEmbeddedButton-sc-e537b447-7 kAhMkb"]');

  console.log("⚠️ Solve captcha + OTP in the browser window...");
  await sleep(45000); // just wait for you to finish login manually

  // grab tokens from localStorage
  const tokens = await page.evaluate(() => {
    return {
      access: localStorage.getItem("privy:access_token"),
      refresh: localStorage.getItem("privy:refresh_token"),
      id: localStorage.getItem("privy:id_token"),
    };
  });

  console.log("✅ Access token:", tokens.access);
  console.log("🔄 Refresh token:", tokens.refresh);
  console.log("🆔 Identity token:", tokens.id);

  await browser.close();
})();
