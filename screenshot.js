// Simple script to take screenshots using Playwright
// Dependencies should be installed in the workflow that uses this action

const { chromium } = require("playwright");
const sharp = require("sharp");
const fs = require("fs");
const path = require("path");
const { spawn } = require("child_process");

const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));

(async () => {
  // Get input parameters from environment variables
  const url = process.env.INPUT_URL || "http://localhost:5000";
  const outputFile = process.env.INPUT_OUTPUT || "screenshot.webp";
  
  // Log the inputs
  console.log(`URL: ${url}`);
  console.log(`Output file: ${outputFile}`);
  
  // Check if URL is localhost - if so, start a server
  let server;
  if (url.includes('localhost') || url.includes('127.0.0.1')) {
    console.log(`🚀 Starting local server on port ${url.split(':')[2] || 5000}...`);
    server = spawn("npx", ["serve", ".", "-l", url.split(':')[2] || 5000], {
      stdio: "inherit",
      shell: true
    });

    await sleep(5000); // wait for server to start
  }

  try {
    const browser = await chromium.launch();
    const page = await browser.newPage();

    console.log(`🌐 Navigating to ${url}`);
    await page.goto(url, { waitUntil: "networkidle" });

    const screenshot = await page.screenshot({ fullPage: true });

    const outputPath = path.resolve(outputFile);
    await sharp(screenshot)
      .webp({ lossless: true, quality: 100, effort: 6 })
      .toFile(outputPath);

    console.log(`✅ Screenshot saved at ${outputPath}`);

    await browser.close();
  } catch (error) {
    console.error('Error taking screenshot:', error);
    process.exit(1);
  } finally {
    // Always stop the server if we started one
    if (server) {
      console.log('Stopping local server...');
      server.kill();
    }
  }
})();