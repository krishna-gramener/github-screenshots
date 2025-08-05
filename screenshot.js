const { chromium } = require("playwright");
const sharp = require("sharp");
const path = require("path");
const { spawn } = require("child_process");
const { URL } = require("url");
const http = require("http");

const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));

function log(level, message, data = {}) {
  const timestamp = new Date().toISOString();
  console.log(JSON.stringify({
    timestamp,
    level,
    message,
    ...data
  }));
}

async function waitForServer(host, port, maxAttempts = 20, interval = 500) {
  log('info', 'Waiting for server', { host, port, maxAttempts, interval });
  
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      await new Promise((resolve, reject) => {
        const req = http.request({ hostname: host, port, path: '/', method: 'HEAD', timeout: 1000 }, 
          res => res.statusCode < 400 ? resolve() : reject(new Error(`Status ${res.statusCode}`)));
        req.on('error', reject);
        req.end();
      });
      
      log('info', 'Server ready', { host, port });
      return true;
    } catch (error) {
      if (attempt % 3 === 0) log('debug', 'Waiting for server', { attempt, maxAttempts });
      await sleep(interval);
    }
  }
  
  log('warn', 'Server not ready after maximum attempts', { host, port, maxAttempts });
  return false;
}

(async () => {
  const workspacePath = process.env.GITHUB_WORKSPACE || process.cwd();
  
  const urls = (process.env.INPUT_URL || "http://localhost:5000").split(',').map(u => u.trim());
  const outputFiles = (process.env.INPUT_OUTPUT || "screenshot.webp").split(',').map(o => o.trim());
  
  const viewportWidth = parseInt(process.env.INPUT_WIDTH || "1280", 10);
  const viewportHeight = process.env.INPUT_HEIGHT ? parseInt(process.env.INPUT_HEIGHT, 10) : null;
  
  let webpOptions, pngOptions, jpegOptions;
  try {
    webpOptions = JSON.parse(process.env.INPUT_WEBP_OPTIONS || '{"lossless":true,"quality":100,"effort":6}');
    pngOptions = JSON.parse(process.env.INPUT_PNG_OPTIONS || '{"quality":100}');
    jpegOptions = JSON.parse(process.env.INPUT_JPEG_OPTIONS || '{"quality":90}');
  } catch (error) {
    log('warn', 'Error parsing format options, using defaults', { error: error.message });
    webpOptions = { lossless: true, quality: 100, effort: 6 };
    pngOptions = { quality: 100 };
    jpegOptions = { quality: 90 };
  }
  
  while (outputFiles.length < urls.length) {
    const base = outputFiles.length > 0 ? outputFiles[outputFiles.length - 1] : "screenshot.webp";
    const ext = path.extname(base);
    const baseName = path.basename(base, ext);
    outputFiles.push(`${baseName}_${outputFiles.length + 1}${ext}`);
  }
  
  log('info', 'Taking screenshots', { count: urls.length });
  
  // Track servers by port
  const servers = {};
  
  // Extract all unique ports from localhost URLs
  const localPorts = new Set();
  urls.forEach(url => {
    if (url.includes('localhost') || url.includes('127.0.0.1')) {
      try {
        const parsedUrl = url.startsWith('http') ? new URL(url) : new URL(`http://${url}`);
        const port = parsedUrl.port ? parseInt(parsedUrl.port, 10) : 5000;
        localPorts.add(port);
      } catch (error) {
        log('warn', 'Could not parse URL', { url, defaultPort: 5000, error: error.message });
        localPorts.add(5000); // Add default port if parsing fails
      }
    }
  });
  
  // Start a server for each unique port
  for (const port of localPorts) {
    log('info', 'Starting local server', { port, workspacePath });
    servers[port] = spawn("npx", ["serve", workspacePath, "--listen", `${port}`], { stdio: "inherit", shell: true });
    await waitForServer('localhost', port, 30, 500);
  }

  try {
    log('info', 'Launching browser');
    const browser = await chromium.launch();
    const page = await browser.newPage();
    
    await page.setViewportSize({ 
      width: viewportWidth, 
      height: viewportHeight || 800
    });
    const results = [];
    
    for (let i = 0; i < urls.length; i++) {
      const url = urls[i];
      const outputFile = outputFiles[i];
      
      log('info', 'Navigating to URL', { url, index: i+1, total: urls.length });
      
      await page.goto(url, { 
        waitUntil: "load", 
        timeout: 30000
      });
      
      await page.waitForTimeout(500);

      const outputPath = path.resolve(workspacePath, outputFile);
      
      const screenshotOptions = viewportHeight 
        ? { fullPage: false }
        : { fullPage: true };
      
      log('info', 'Taking screenshot', { fullPage: screenshotOptions.fullPage, outputFile });
      
      const screenshotBuffer = await page.screenshot(screenshotOptions);
      const ext = path.extname(outputFile).toLowerCase();
      
      const sharpImage = sharp(screenshotBuffer);
      
      switch (ext) {
        case '.png':
          await sharpImage.png(pngOptions).toFile(outputPath);
          break;
        case '.jpg':
        case '.jpeg':
          await sharpImage.jpeg(jpegOptions).toFile(outputPath);
          break;
        case '.webp':
        default:
          await sharpImage.webp(webpOptions).toFile(outputPath);
          break;
      }

      log('info', 'Screenshot saved', { path: outputPath, format: ext.replace('.', '') });
      results.push(outputPath);
    }
    
    console.log(`::set-output name=screenshot_paths::${results.join(',')}`);
    if (results.length > 0) console.log(`::set-output name=screenshot_path::${results[0]}`);

    log('info', 'Closing browser');
    await browser.close();
  } catch (error) {
    log('error', 'Error taking screenshot', { error: error.message, stack: error.stack });
    process.exit(1);
  } finally {
    // Stop all servers
    if (Object.keys(servers).length > 0) {
      log('info', 'Stopping local servers');
      for (const port in servers) {
        if (servers[port]) {
          log('debug', 'Stopping server on port', { port });
          servers[port].kill();
        }
      }
    }
  }
})();