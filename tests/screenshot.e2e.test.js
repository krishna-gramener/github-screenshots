// Purpose: E2E test that runs screenshot.js with real Playwright/Sharp/Sirv.
// Notes: Skips unless E2E=1. Requires browsers (npx playwright install chromium).

const fs = require("fs");
const fsp = require("fs").promises;
const path = require("path");

const maybe = process.env.E2E === "1" ? test : test.skip;

maybe(
  "E2E: takes a screenshot of tests/test.html via local server",
  async () => {
    process.env.GITHUB_WORKSPACE = process.cwd();
    const outPath = path.join(process.cwd(), "test-results", "e2e.webp");
    process.env.SCREENSHOTS = `/tests/test.html=${path.relative(process.cwd(), outPath)}`;
    delete process.env.INPUT_HEIGHT; // ensure fullPage default

    // Ensure clean output
    if (fs.existsSync(outPath)) await fsp.rm(outPath);

    // Run the action script (async IIFE) then poll for output
    require(path.resolve(process.cwd(), "screenshot.js"));
    const deadline = Date.now() + 45000;
    let stat;
    while (Date.now() < deadline) {
      try {
        stat = await fsp.stat(outPath);
        break;
      } catch (_) {
        await new Promise((r) => setTimeout(r, 300));
      }
    }
    expect(stat).toBeDefined();
    expect(stat.isFile()).toBe(true);
    expect(stat.size).toBeGreaterThan(0);

    // Basic image validation
    const sharp = require("sharp");
    const meta = await sharp(outPath).metadata();
    expect(meta.format).toBe("webp");
    expect((meta.width || 0) > 0 && (meta.height || 0) > 0).toBe(true);
  },
  60000,
);
