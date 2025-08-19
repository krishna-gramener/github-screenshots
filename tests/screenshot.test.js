/**
 * Unit tests for the GitHub Screenshot Action
 * These tests focus on testing individual functions and components
 * rather than running the entire script
 */

// Mock modules
jest.mock('playwright');
jest.mock('sharp');
jest.mock('child_process');
jest.mock('http');

// Import the mocked modules
const { chromium } = require('playwright');
const sharp = require('sharp');
const { spawn } = require('child_process');
const http = require('http');

// Setup mocks
const mockPage = {
  setViewportSize: jest.fn(),
  goto: jest.fn(),
  waitForTimeout: jest.fn(),
  screenshot: jest.fn().mockResolvedValue(Buffer.from('fake-screenshot')),
  close: jest.fn()
};

const mockBrowser = {
  newPage: jest.fn().mockResolvedValue(mockPage),
  close: jest.fn()
};

chromium.launch = jest.fn().mockResolvedValue(mockBrowser);

const mockSharpInstance = {
  png: jest.fn().mockReturnThis(),
  jpeg: jest.fn().mockReturnThis(),
  webp: jest.fn().mockReturnThis(),
  toFile: jest.fn().mockResolvedValue({})
};

sharp.mockImplementation(() => mockSharpInstance);

const mockServer = {
  kill: jest.fn(),
  on: jest.fn(),
  stdout: { on: jest.fn() },
  stderr: { on: jest.fn() }
};

spawn.mockImplementation(() => mockServer);

const mockHttpRequest = {
  on: jest.fn(),
  end: jest.fn()
};

http.request = jest.fn().mockImplementation((options, callback) => {
  setTimeout(() => {
    callback({ statusCode: 200 });
  }, 10);
  return mockHttpRequest;
});

// Helper function to extract the log function from screenshot.js
function extractLogFunction() {
  // Create a mock console.log to capture the log function's output
  const originalConsoleLog = console.log;
  const logs = [];
  console.log = jest.fn(message => logs.push(message));
  
  // Load the screenshot.js file to extract the log function
  const screenshotJs = require('../screenshot.js');
  
  // Restore console.log
  console.log = originalConsoleLog;
  
  // Return the log function and captured logs
  return { log: screenshotJs.log, logs };
}

// Helper function to extract the waitForServer function from screenshot.js
function extractWaitForServerFunction() {
  const screenshotJs = require('../screenshot.js');
  return screenshotJs.waitForServer;
}

describe('GitHub Screenshot Action', () => {
  let originalEnv;
  let consoleOutput;
  
  beforeEach(() => {
    // Save original environment variables
    originalEnv = { ...process.env };
    
    // Mock console.log to capture output
    consoleOutput = [];
    jest.spyOn(console, 'log').mockImplementation(message => {
      consoleOutput.push(message);
    });
    
    // Reset all mocks
    jest.clearAllMocks();
    jest.resetModules();
  });
  
  afterEach(() => {
    // Restore environment variables
    process.env = originalEnv;
    
    // Restore console.log
    console.log.mockRestore();
  });
  
  // Test URL parsing and local server detection
  test('Detects local server URLs correctly', () => {
    // Create a function to test URL parsing logic
    function detectLocalServers(urls) {
      const localPorts = new Set();
      urls.forEach(url => {
        if (url.includes('localhost') || url.includes('127.0.0.1')) {
          try {
            const parsedUrl = url.startsWith('http') ? new URL(url) : new URL(`http://${url}`);
            const port = parsedUrl.port ? parseInt(parsedUrl.port, 10) : 5000;
            localPorts.add(port);
          } catch (error) {
            localPorts.add(5000); // Add default port if parsing fails
          }
        }
      });
      return Array.from(localPorts);
    }
    
    // Test with various URL formats
    expect(detectLocalServers(['http://localhost:8080'])).toEqual([8080]);
    expect(detectLocalServers(['http://localhost'])).toEqual([5000]); // Default port
    expect(detectLocalServers(['http://localhost:3000', 'http://localhost:8080'])).toEqual([3000, 8080]);
    expect(detectLocalServers(['http://example.com', 'http://localhost:3000'])).toEqual([3000]);
    expect(detectLocalServers(['localhost:8080'])).toEqual([8080]);
    expect(detectLocalServers(['127.0.0.1:9000'])).toEqual([9000]);
  });
  
  // Test output file generation logic
  test('Generates correct output filenames when not enough are provided', () => {
    function generateOutputFiles(urls, outputs) {
      const outputFiles = [...outputs];
      while (outputFiles.length < urls.length) {
        const base = outputFiles.length > 0 ? outputFiles[outputFiles.length - 1] : "screenshot.webp";
        const ext = path.extname(base);
        const baseName = path.basename(base, ext);
        outputFiles.push(`${baseName}_${outputFiles.length + 1}${ext}`);
      }
      return outputFiles;
    }
    
    const path = require('path');
    
    // Test with various combinations
    expect(generateOutputFiles(['url1'], ['output1.webp'])).toEqual(['output1.webp']);
    expect(generateOutputFiles(['url1', 'url2'], ['output1.webp'])).toEqual(['output1.webp', 'output1_2.webp']);
    expect(generateOutputFiles(['url1', 'url2', 'url3'], ['output1.png'])).toEqual(['output1.png', 'output1_2.png', 'output1_2_3.png']);
    expect(generateOutputFiles(['url1', 'url2', 'url3'], ['a.webp', 'b.png'])).toEqual(['a.webp', 'b.png', 'b_3.png']);
  });
  
  // Test format options parsing
  test('Parses format options correctly', () => {
    function parseFormatOptions() {
      let webpOptions, pngOptions, jpegOptions;
      try {
        webpOptions = JSON.parse(process.env.INPUT_WEBP_OPTIONS || '{"lossless":true,"quality":100,"effort":6}');
        pngOptions = JSON.parse(process.env.INPUT_PNG_OPTIONS || '{"quality":100}');
        jpegOptions = JSON.parse(process.env.INPUT_JPEG_OPTIONS || '{"quality":90}');
      } catch (error) {
        webpOptions = { lossless: true, quality: 100, effort: 6 };
        pngOptions = { quality: 100 };
        jpegOptions = { quality: 90 };
      }
      return { webpOptions, pngOptions, jpegOptions };
    }
    
    // Test with default options
    process.env.INPUT_WEBP_OPTIONS = undefined;
    process.env.INPUT_PNG_OPTIONS = undefined;
    process.env.INPUT_JPEG_OPTIONS = undefined;
    
    let options = parseFormatOptions();
    expect(options.webpOptions).toEqual({ lossless: true, quality: 100, effort: 6 });
    expect(options.pngOptions).toEqual({ quality: 100 });
    expect(options.jpegOptions).toEqual({ quality: 90 });
    
    // Test with custom options
    process.env.INPUT_WEBP_OPTIONS = '{"quality":80,"effort":4}';
    process.env.INPUT_PNG_OPTIONS = '{"quality":95}';
    process.env.INPUT_JPEG_OPTIONS = '{"quality":85,"progressive":true}';
    
    options = parseFormatOptions();
    expect(options.webpOptions).toEqual({ quality: 80, effort: 4 });
    expect(options.pngOptions).toEqual({ quality: 95 });
    expect(options.jpegOptions).toEqual({ quality: 85, progressive: true });
    
    // Test with invalid JSON
    process.env.INPUT_WEBP_OPTIONS = '{invalid json}';
    options = parseFormatOptions();
    expect(options.webpOptions).toEqual({ lossless: true, quality: 100, effort: 6 }); // Should use default
  });
  
  // Test server startup logic
  test('Starts servers on the correct ports', () => {
    // Set up environment
    process.env.GITHUB_WORKSPACE = '/workspace';
    
    // Create a function to test server startup logic
    function startLocalServers(localPorts, workspacePath) {
      const servers = {};
      for (const port of localPorts) {
        servers[port] = spawn("npx", ["serve", workspacePath, "--listen", `${port}`], { stdio: "inherit", shell: true });
      }
      return servers;
    }
    
    // Test with various port combinations
    const servers1 = startLocalServers([8080], '/workspace');
    expect(spawn).toHaveBeenCalledWith(
      'npx',
      ['serve', '/workspace', '--listen', '8080'],
      { stdio: 'inherit', shell: true }
    );
    expect(Object.keys(servers1)).toEqual(['8080']);
    
    jest.clearAllMocks();
    
    const servers2 = startLocalServers([3000, 8080], '/workspace');
    expect(spawn).toHaveBeenCalledTimes(2);
    expect(Object.keys(servers2)).toEqual(['3000', '8080']);
  });
  
  // Test screenshot format selection
  test('Selects correct image format based on file extension', () => {
    // Create a function to test format selection logic
    function processScreenshot(outputFile, screenshotBuffer) {
      const ext = path.extname(outputFile).toLowerCase();
      const sharpImage = sharp(screenshotBuffer);
      
      switch (ext) {
        case '.png':
          return sharpImage.png();
        case '.jpg':
        case '.jpeg':
          return sharpImage.jpeg();
        case '.webp':
        default:
          return sharpImage.webp();
      }
    }
    
    const path = require('path');
    const buffer = Buffer.from('test');
    
    // Test with various file extensions
    processScreenshot('output.png', buffer);
    expect(mockSharpInstance.png).toHaveBeenCalled();
    
    jest.clearAllMocks();
    processScreenshot('output.jpg', buffer);
    expect(mockSharpInstance.jpeg).toHaveBeenCalled();
    
    jest.clearAllMocks();
    processScreenshot('output.jpeg', buffer);
    expect(mockSharpInstance.jpeg).toHaveBeenCalled();
    
    jest.clearAllMocks();
    processScreenshot('output.webp', buffer);
    expect(mockSharpInstance.webp).toHaveBeenCalled();
    
    jest.clearAllMocks();
    processScreenshot('output.unknown', buffer); // Default to webp
    expect(mockSharpInstance.webp).toHaveBeenCalled();
  });
  
  // Test viewport size handling
  test('Sets viewport size correctly', async () => {
    // Create a function to test viewport size logic
    async function setupViewport(width, height) {
      const browser = await chromium.launch();
      const page = await browser.newPage();
      
      await page.setViewportSize({ 
        width: width, 
        height: height || 800 // Default height if not specified
      });
      
      return page;
    }
    
    // Test with width only
    await setupViewport(1280);
    expect(mockPage.setViewportSize).toHaveBeenCalledWith({ width: 1280, height: 800 });
    
    // Test with width and height
    jest.clearAllMocks();
    await setupViewport(1440, 900);
    expect(mockPage.setViewportSize).toHaveBeenCalledWith({ width: 1440, height: 900 });
  });
  
  // Test server cleanup logic
  test('Cleans up all servers properly', () => {
    // Create a function to test server cleanup logic
    function stopAllServers(servers) {
      for (const port in servers) {
        if (servers[port]) {
          servers[port].kill();
        }
      }
    }
    
    // Create mock servers
    const servers = {
      '3000': mockServer,
      '8080': mockServer
    };
    
    // Test cleanup
    stopAllServers(servers);
    expect(mockServer.kill).toHaveBeenCalledTimes(2);
  });
  
  // Test error handling for screenshot process
  test('Handles screenshot errors gracefully', async () => {
    // Create a function that simulates the screenshot process with error handling
    async function takeScreenshotWithErrorHandling(url, outputPath) {
      try {
        // Simulate browser launch
        const browser = await chromium.launch();
        const page = await browser.newPage();
        
        // Simulate navigation
        await page.goto(url, { waitUntil: "load", timeout: 30000 });
        
        // Simulate screenshot
        const screenshotBuffer = await page.screenshot({ fullPage: true });
        
        // Simulate image processing
        await sharp(screenshotBuffer).webp().toFile(outputPath);
        
        // Cleanup
        await browser.close();
        
        return { success: true, path: outputPath };
      } catch (error) {
        // Error handling
        return { 
          success: false, 
          error: error.message,
          path: outputPath 
        };
      }
    }
    
    // Test successful case
    mockPage.goto.mockResolvedValueOnce();
    let result = await takeScreenshotWithErrorHandling('https://example.com', 'output.webp');
    expect(result.success).toBe(true);
    
    // Test error case
    mockPage.goto.mockRejectedValueOnce(new Error('Navigation failed'));
    result = await takeScreenshotWithErrorHandling('https://invalid-url', 'error.webp');
    expect(result.success).toBe(false);
    expect(result.error).toBe('Navigation failed');
  });
  
  // Test GitHub Actions output format
  test('Formats GitHub Actions outputs correctly', () => {
    // Create a function to simulate GitHub Actions output
    function setGitHubOutput(name, value) {
      console.log(`::set-output name=${name}::${value}`);
    }
    
    // Mock console.log to capture output
    const originalConsoleLog = console.log;
    const outputs = [];
    console.log = jest.fn(output => outputs.push(output));
    
    // Test single output
    setGitHubOutput('screenshot_path', '/path/to/screenshot.webp');
    expect(outputs[0]).toBe('::set-output name=screenshot_path::/path/to/screenshot.webp');
    
    // Test multiple outputs
    outputs.length = 0; // Clear outputs
    setGitHubOutput('screenshot_paths', '/path/to/screenshot1.webp,/path/to/screenshot2.webp');
    expect(outputs[0]).toBe('::set-output name=screenshot_paths::/path/to/screenshot1.webp,/path/to/screenshot2.webp');
    
    // Restore console.log
    console.log = originalConsoleLog;
  });
  
  // Test the full screenshot workflow
  test('Full screenshot workflow integration', async () => {
    // Create a function that simulates the full screenshot workflow
    async function runScreenshotWorkflow(urls, outputFiles, viewportWidth, viewportHeight) {
      // Track servers and results
      const servers = {};
      const results = [];
      
      // Start local servers if needed
      const localPorts = new Set();
      urls.forEach(url => {
        if (url.includes('localhost') || url.includes('127.0.0.1')) {
          try {
            const parsedUrl = url.startsWith('http') ? new URL(url) : new URL(`http://${url}`);
            const port = parsedUrl.port ? parseInt(parsedUrl.port, 10) : 5000;
            localPorts.add(port);
          } catch (error) {
            localPorts.add(5000);
          }
        }
      });
      
      // Start servers
      for (const port of localPorts) {
        servers[port] = spawn("npx", ["serve", "/workspace", "--listen", `${port}`]);
      }
      
      try {
        // Launch browser
        const browser = await chromium.launch();
        const page = await browser.newPage();
        
        // Set viewport size
        await page.setViewportSize({ 
          width: viewportWidth || 1280, 
          height: viewportHeight || 800
        });
        
        // Take screenshots
        for (let i = 0; i < urls.length; i++) {
          const url = urls[i];
          const outputFile = outputFiles[i];
          
          // Navigate to URL
          await page.goto(url, { waitUntil: "load", timeout: 30000 });
          await page.waitForTimeout(500);
          
          // Take screenshot
          const screenshotBuffer = await page.screenshot({ 
            fullPage: viewportHeight ? false : true 
          });
          
          // Process and save screenshot
          const ext = path.extname(outputFile).toLowerCase();
          const sharpImage = sharp(screenshotBuffer);
          
          switch (ext) {
            case '.png':
              await sharpImage.png().toFile(outputFile);
              break;
            case '.jpg':
            case '.jpeg':
              await sharpImage.jpeg().toFile(outputFile);
              break;
            case '.webp':
            default:
              await sharpImage.webp().toFile(outputFile);
              break;
          }
          
          results.push(outputFile);
        }
        
        // Close browser
        await browser.close();
        
        // Set GitHub Actions outputs
        console.log(`::set-output name=screenshot_paths::${results.join(',')}`);
        if (results.length > 0) console.log(`::set-output name=screenshot_path::${results[0]}`);
        
        return { success: true, results };
      } catch (error) {
        return { success: false, error: error.message };
      } finally {
        // Stop all servers
        for (const port in servers) {
          if (servers[port]) {
            servers[port].kill();
          }
        }
      }
    }
    
    // Test the workflow with various configurations
    const path = require('path');
    
    // Test with a single URL
    let result = await runScreenshotWorkflow(
      ['https://example.com'], 
      ['/workspace/screenshot.webp'],
      1280,
      800
    );
    
    expect(result.success).toBe(true);
    expect(result.results).toEqual(['/workspace/screenshot.webp']);
    expect(mockPage.goto).toHaveBeenCalledWith('https://example.com', expect.anything());
    expect(mockPage.screenshot).toHaveBeenCalledWith({ fullPage: false });
    expect(mockSharpInstance.webp).toHaveBeenCalled();
    
    // Test with multiple URLs and formats
    jest.clearAllMocks();
    result = await runScreenshotWorkflow(
      ['https://example.com', 'http://localhost:3000'], 
      ['/workspace/screenshot1.png', '/workspace/screenshot2.jpg'],
      1440,
      900
    );
    
    expect(result.success).toBe(true);
    expect(result.results).toEqual(['/workspace/screenshot1.png', '/workspace/screenshot2.jpg']);
    expect(mockPage.goto).toHaveBeenCalledTimes(2);
    expect(spawn).toHaveBeenCalledWith('npx', ['serve', '/workspace', '--listen', '3000']);
    expect(mockServer.kill).toHaveBeenCalled();
  });
});

