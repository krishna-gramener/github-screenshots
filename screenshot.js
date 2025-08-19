const { chromium } = require("playwright");
const sharp = require("sharp");
const path = require("path");
const fs = require("fs").promises;
const polka = require("polka");
const sirv = require("sirv");
const pino = require("pino");

// Configure minimal logger and helpers
const log = pino({ level: process.env.LOG_LEVEL || "info" });
const ensureDir = async (dir) => fs.mkdir(dir, { recursive: true });

// Create a simple HTTP server with polka and sirv
async function createServer(rootDir, host, port) {
  return new Promise((resolve, reject) => {
    // Create server with sirv middleware
    const server = polka()
      .use(sirv(rootDir, { dev: true }))
      .listen(port, host, (err) => {
        if (err) return reject(err);
        log.info("Server listening", { host, port, rootDir });
        resolve(server);
      });
  });
}

(async () => {
  // Setup environment and parse inputs
  const workspacePath = process.env.GITHUB_WORKSPACE || process.cwd();
  const parsePairs = (input) =>
    (input || "/=screenshot.webp")
      .split(/[\n,]+/) // support commas or newlines with whitespace
      .map((s) => s.trim())
      .filter(Boolean)
      .map((p) => {
        const [urlPath, outputPath] = p.split("=").map((x) => x.trim());
        return { urlPath, outputPath };
      });
  const screenshotPairs = parsePairs(process.env.SCREENSHOTS);

  // Parse viewport and image options
  const viewportWidth = parseInt(process.env.INPUT_WIDTH || "1280", 10);
  const viewportHeight = process.env.INPUT_HEIGHT ? parseInt(process.env.INPUT_HEIGHT, 10) : null;
  const options = {
    webp: process.env.INPUT_WEBP_OPTIONS
      ? JSON.parse(process.env.INPUT_WEBP_OPTIONS)
      : { lossless: true, quality: 100 },
    png: process.env.INPUT_PNG_OPTIONS ? JSON.parse(process.env.INPUT_PNG_OPTIONS) : { quality: 100 },
    jpeg: process.env.INPUT_JPEG_OPTIONS ? JSON.parse(process.env.INPUT_JPEG_OPTIONS) : { quality: 90 },
  };

  // Start local server if needed
  let server = null;
  const port = parseInt(process.env.INPUT_PORT || "3000", 10);
  const host = process.env.INPUT_HOST || "0.0.0.0";
  const isAbsoluteUrl = (url) => /^https?:\/\//i.test(url);
  if (screenshotPairs.some((pair) => !isAbsoluteUrl(pair.urlPath))) {
    log.info("Starting local server", { host, port });
    server = await createServer(workspacePath, host, port);
  }

  try {
    // Launch browser and take screenshots
    const browser = await chromium.launch();
    const page = await browser.newPage();
    await page.setViewportSize({ width: viewportWidth, height: viewportHeight || 800 });

    // Process all screenshots
    const results = [];
    for (const { urlPath, outputPath } of screenshotPairs) {
      // Build URL and navigate
      const localPath = urlPath.startsWith("/") ? urlPath : "/" + urlPath;
      const url = isAbsoluteUrl(urlPath) ? urlPath : `http://localhost:${port}${localPath}`;
      log.info("Processing", { url, output: outputPath });

      await page.goto(url, { waitUntil: "load", timeout: 30000 });
      await page.waitForTimeout(500); // Small delay to ensure page is fully rendered

      // Take and save screenshot
      const fullOutputPath = path.resolve(workspacePath, outputPath);
      await ensureDir(path.dirname(fullOutputPath));
      const buffer = await page.screenshot({ fullPage: !viewportHeight });

      // Process with sharp based on extension
      const ext = path.extname(outputPath).toLowerCase();
      if (ext === ".png") {
        await sharp(buffer).png(options.png).toFile(fullOutputPath);
      } else if ([".jpg", ".jpeg"].includes(ext)) {
        await sharp(buffer).jpeg(options.jpeg).toFile(fullOutputPath);
      } else {
        await sharp(buffer).webp(options.webp).toFile(fullOutputPath);
      }

      log.info("Screenshot saved", { path: fullOutputPath });
      results.push(fullOutputPath);
    }

    // Set outputs and cleanup
    log.info(`::set-output name=screenshot_paths::${results.join(",")}`);
    if (results.length > 0) log.info(`::set-output name=screenshot_path::${results[0]}`);
    await browser.close();
  } catch (error) {
    log.error("Error taking screenshot", { error: error.message });
    process.exit(1);
  } finally {
    if (server && server.server) server.server.close();
  }
})();
