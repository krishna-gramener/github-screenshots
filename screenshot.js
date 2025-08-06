const { chromium } = require("playwright");
const sharp = require("sharp");
const path = require("path");
const http = require("http");
const fs = require("fs").promises;
const { URL } = require("url");
const mime = require("mime-types");

// Helper for timed operations
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

// Create a simple HTTP server to serve static files
function createServer(rootDir, port) {
  const serveFile = async (res, filePath, contentType) => {
    const content = await fs.readFile(filePath);
    res.writeHead(200, { 'Content-Type': contentType || mime.lookup(filePath) || 'application/octet-stream' });
    res.end(content);
  };

  const serveDirectoryListing = async (res, dirPath, urlPath) => {
    const files = await fs.readdir(dirPath);
    const html = `<html><body><h1>Directory: ${urlPath}</h1><ul>
      ${files.map(f => `<li><a href="${path.join(urlPath, f)}">${f}</a></li>`).join('')}
    </ul></body></html>`;
    res.writeHead(200, { 'Content-Type': 'text/html' });
    res.end(html);
  };

  return new Promise((resolve, reject) => {
    const server = http.createServer(async (req, res) => {
      try {
        // Process URL path
        const pathname = new URL(req.url, `http://localhost:${port}`).pathname;
        const filePath = path.join(rootDir, pathname === '/' ? '/index.html' : pathname);
        
        try {
          const stats = await fs.stat(filePath);
          
          if (stats.isDirectory()) {
            // Try index.html in directory, fall back to directory listing
            const indexPath = path.join(filePath, 'index.html');
            await fs.access(indexPath).then(
              () => serveFile(res, indexPath, 'text/html'),
              () => serveDirectoryListing(res, filePath, pathname)
            );
          } else {
            await serveFile(res, filePath);
          }
        } catch {
          res.writeHead(404, { 'Content-Type': 'text/plain' });
          res.end('404 Not Found');
        }
      } catch (err) {
        res.writeHead(500, { 'Content-Type': 'text/plain' });
        res.end('Internal Server Error');
        log('error', 'Server error', { error: err.message });
      }
    });
    
    server.on('error', reject);
    server.listen(port, () => {
      log('info', `Server started on port ${port}`);
      resolve(server);
    });
  });
}

// Wait for server to be ready
async function waitForServer(host, port, maxAttempts = 20, interval = 500) {
  log('info', 'Waiting for server', { host, port });
  
  // Helper to check if server is responding
  const checkServer = () => new Promise((resolve, reject) => {
    const req = http.request({ 
      hostname: host, port, path: '/', method: 'HEAD', timeout: 1000 
    }, res => res.statusCode < 400 ? resolve() : reject());
    req.on('error', reject);
    req.end();
  });
  
  // Try connecting multiple times
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      await checkServer();
      log('info', 'Server ready', { host, port });
      return true;
    } catch {
      if (attempt % 3 === 0) log('debug', 'Waiting for server', { attempt });
      await sleep(interval);
    }
  }
  
  log('warn', 'Server not ready after maximum attempts', { host, port });
  return false;
}

(async () => {
  const workspacePath = process.env.GITHUB_WORKSPACE || process.cwd();
  let server = null;
  let serverPort = null;
  
  // Parse SCREENSHOTS format: "/=screenshot.webp,topics/=topics/screenshot.webp,chat.html=img/chat.png"
  const screenshotPairs = (process.env.SCREENSHOTS || "/=screenshot.webp")
    .split(',')
    .filter(Boolean)
    .map(pair => {
      const [urlPath, outputPath] = pair.trim().split('=').map(part => part.trim());
      return { urlPath, outputPath };
    });
  
  const viewportWidth = parseInt(process.env.INPUT_WIDTH || "1280", 10);
  const viewportHeight = process.env.INPUT_HEIGHT ? parseInt(process.env.INPUT_HEIGHT, 10) : null;
  
  let webpOptions, pngOptions, jpegOptions;
  // Default options for image formats
  const defaultOptions = {
    webp: { lossless: true, quality: 100, effort: 6 },
    png: { quality: 100 },
    jpeg: { quality: 90 }
  };
  
  try {
    webpOptions = JSON.parse(process.env.INPUT_WEBP_OPTIONS || JSON.stringify(defaultOptions.webp));
    pngOptions = JSON.parse(process.env.INPUT_PNG_OPTIONS || JSON.stringify(defaultOptions.png));
    jpegOptions = JSON.parse(process.env.INPUT_JPEG_OPTIONS || JSON.stringify(defaultOptions.jpeg));
  } catch (error) {
    log('warn', 'Error parsing format options, using defaults', { error: error.message });
    webpOptions = defaultOptions.webp;
    pngOptions = defaultOptions.png;
    jpegOptions = defaultOptions.jpeg;
  }
  
  log('info', 'Taking screenshots', { count: screenshotPairs.length });
  
  // Check if we need to start a local server
  const isAbsoluteUrl = url => /^https?:\/\//i.test(url);
  const needsLocalServer = screenshotPairs.some(pair => !isAbsoluteUrl(pair.urlPath));
  
  if (needsLocalServer) {
    // Start a local server
    serverPort = parseInt(process.env.INPUT_PORT || "3000", 10);
    log('info', 'Starting local server', { port: serverPort, workspacePath });
    try {
      server = await createServer(workspacePath, serverPort);
      await waitForServer('localhost', serverPort);
    } catch (error) {
      log('error', 'Failed to start server', { error: error.message });
      process.exit(1);
    }
  }

  try {
    log('info', 'Launching browser');
    const browser = await chromium.launch();
    const page = await browser.newPage();
    await page.setViewportSize({ width: viewportWidth, height: viewportHeight || 800 });
    
    // Helper function to process a single screenshot
    const processScreenshot = async ({ urlPath, outputPath }, index) => {
      // Construct the full URL
      const url = isAbsoluteUrl(urlPath) ? urlPath :
                 server ? `http://localhost:${serverPort}${urlPath.startsWith('/') ? urlPath : '/' + urlPath}` :
                 urlPath;
      
      log('info', 'Processing', { urlPath, outputPath, index: index+1, total: screenshotPairs.length });
      
      // Navigate and capture screenshot
      await page.goto(url, { waitUntil: "load", timeout: 30000 });
      await page.waitForTimeout(500);
      
      // Prepare output path
      const fullOutputPath = path.resolve(workspacePath, outputPath);
      await ensureDirectoryExists(path.dirname(fullOutputPath));
      
      // Take screenshot
      const screenshotOptions = { fullPage: !viewportHeight };
      const screenshotBuffer = await page.screenshot(screenshotOptions);
      
      // Save with appropriate format
      const ext = path.extname(outputPath).toLowerCase();
      const sharpImage = sharp(screenshotBuffer);
      
      if (ext === '.png') {
        await sharpImage.png(pngOptions).toFile(fullOutputPath);
      } else if (['.jpg', '.jpeg'].includes(ext)) {
        await sharpImage.jpeg(jpegOptions).toFile(fullOutputPath);
      } else {
        await sharpImage.webp(webpOptions).toFile(fullOutputPath);
      }

      log('info', 'Screenshot saved', { path: fullOutputPath, format: ext.slice(1) });
      return fullOutputPath;
    };
    
    // Process all screenshots
    const results = [];
    for (let i = 0; i < screenshotPairs.length; i++) {
      results.push(await processScreenshot(screenshotPairs[i], i));
    }
    
    // Set GitHub Action outputs
    console.log(`::set-output name=screenshot_paths::${results.join(',')}`);
    if (results.length > 0) console.log(`::set-output name=screenshot_path::${results[0]}`);

    log('info', 'Closing browser');
    await browser.close();
  } catch (error) {
    log('error', 'Error taking screenshot', { error: error.message, stack: error.stack });
    process.exit(1);
  } finally {
    // Stop the server if it was started
    if (server) {
      log('info', 'Stopping local server');
      server.close();
    }
  }
})();

// Helper function to ensure directory exists
async function ensureDirectoryExists(dirPath) {
  try {
    await fs.mkdir(dirPath, { recursive: true });
  } catch (error) {
    if (error.code !== 'EEXIST') {
      throw error;
    }
  }
}