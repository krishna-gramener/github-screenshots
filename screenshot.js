const { chromium } = require("playwright");
const sharp = require("sharp");
const fs = require("fs");
const path = require("path");
const { spawn } = require("child_process");

const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));

(async () => {
  console.log("🚀 Starting local server on port 5000...");
  const server = spawn("npx", ["serve", ".", "-l", "5000"], {
    stdio: "inherit",
    shell: true
  });

  await sleep(5000); // wait for server to start

  const browser = await chromium.launch();
  const page = await browser.newPage();

  const url = "http://localhost:5000";
  console.log(`🌐 Navigating to ${url}`);
  await page.goto(url, { waitUntil: "networkidle" });

  const screenshot = await page.screenshot({ fullPage: true });

  const outputPath = path.resolve("screenshot.webp");
  await sharp(screenshot)
    .webp({ lossless: true, quality: 100, effort: 6 })
    .toFile(outputPath);

  console.log(`✅ Screenshot saved at ${outputPath}`);

  await browser.close();
  server.kill(); // stop server
})();
