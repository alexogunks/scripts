// grab-from-chrome-profile.js
import puppeteer from "puppeteer";
import fs from "fs";

const APP_URL = "https://app.pett.ai";
const CHROME_PATH = "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe";
const PROFILE_PATH = "C:\Users\USER\OneDrive\Desktop\Your Chrome - Chrome.lnk";

const OUTPUT = {
  access: "./jwt.txt",
  refresh: "./refresh.txt",
};

(async () => {
  const browser = await puppeteer.launch({
    headless: false,
    executablePath: CHROME_PATH,
    userDataDir: PROFILE_PATH,  // 👈 reuse your real Chrome profile
    defaultViewport: null,
  });

  const [page] = await browser.pages();
  await page.goto(APP_URL, { waitUntil: "networkidle2" });

  // Pull Privy tokens directly from localStorage
  const tokens = await page.evaluate(() => ({
    access: localStorage.getItem("privy:access_token"),
    refresh: localStorage.getItem("privy:refresh_token"),
    id: localStorage.getItem("privy:id_token"),
  }));

  fs.writeFileSync(OUTPUT.access, tokens.access ?? "", "utf8");
  fs.writeFileSync(OUTPUT.refresh, tokens.refresh ?? "", "utf8");

  console.log("✅ Tokens saved to jwt.txt and refresh.txt");
  console.log(tokens);

  await browser.close();
})();
