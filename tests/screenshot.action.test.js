// Purpose: High-signal tests covering behaviors described in README and implemented in screenshot.js
// Notes: Mocks external libs; avoids real browser/server/I/O. Focus on normal flows, not edge errors.

const path = require("path");

// Dynamic mocks per test using jest.doMock + isolateModules
function withMockedModules(factories, run) {
  jest.resetModules();
  Object.entries(factories).forEach(([mod, factory]) => jest.doMock(mod, factory));
  return (async () => {
    jest.isolateModules(() => {
      run();
    });
    // Allow the async IIFE in screenshot.js to run to completion using mocks
    await new Promise((r) => setImmediate(r));
  })();
}

// Build common mocks we can tweak per test
function buildMocks() {
  const mkdir = jest.fn(() => Promise.resolve());

  const page = {
    setViewportSize: jest.fn(() => Promise.resolve()),
    goto: jest.fn(() => Promise.resolve()),
    waitForTimeout: jest.fn(() => Promise.resolve()),
    screenshot: jest.fn(() => Promise.resolve(Buffer.from("buf"))),
  };
  const browser = { newPage: jest.fn(() => Promise.resolve(page)), close: jest.fn(() => Promise.resolve()) };

  const chromium = { launch: jest.fn(() => Promise.resolve(browser)) };

  const sharpInstance = {
    png: jest.fn().mockReturnThis(),
    jpeg: jest.fn().mockReturnThis(),
    webp: jest.fn().mockReturnThis(),
    toFile: jest.fn(() => Promise.resolve()),
  };
  const sharp = jest.fn(() => sharpInstance);

  // polka() -> app.use(...) -> app.listen(port, cb) => { server: { close } }
  const httpServer = { close: jest.fn() };
  const app = {
    use: jest.fn(() => app),
    listen: jest.fn((port, hostOrCb, maybeCb) => {
      const cb = typeof hostOrCb === "function" ? hostOrCb : maybeCb;
      setImmediate(() => cb && cb());
      return { server: httpServer };
    }),
  };
  const polka = jest.fn(() => app);
  const sirv = jest.fn(() => (req, res, next) => next && next());

  const pinoInstance = { info: jest.fn(), error: jest.fn() };
  const pino = jest.fn(() => pinoInstance);

  return { mkdir, page, browser, chromium, sharpInstance, sharp, httpServer, app, polka, sirv, pinoInstance, pino };
}

describe("screenshot.js integration (mocked)", () => {
  const ORIGINAL_ENV = { ...process.env };

  beforeEach(() => {
    jest.resetAllMocks();
    process.env = { ...ORIGINAL_ENV, GITHUB_WORKSPACE: path.resolve("/workspace") };
  });

  afterAll(() => {
    process.env = ORIGINAL_ENV;
  });

  test("Parses mixed comma/newline input, trims, ignores blanks; starts server for relative URLs", async () => {
    const mocks = buildMocks();
    const SCREENSHOTS = `\n  /index.html=out/home.webp,\n  /about.html=out/about.png\n\n  /products/list.html=out/products.webp,\n`; // trailing comma + blanks

    await withMockedModules(
      {
        fs: () => ({ promises: { mkdir: mocks.mkdir } }),
        playwright: () => ({ chromium: mocks.chromium }),
        sharp: () => mocks.sharp,
        polka: () => mocks.polka,
        sirv: () => mocks.sirv,
        pino: () => mocks.pino,
      },
      () => {
        process.env.SCREENSHOTS = SCREENSHOTS;
        require(path.resolve(process.cwd(), "screenshot.js"));
      },
    );

    // Server started once
    expect(mocks.polka).toHaveBeenCalledTimes(1);
    expect(mocks.app.listen).toHaveBeenCalledWith(3000, "0.0.0.0", expect.any(Function));

    // Browser usage
    expect(mocks.chromium.launch).toHaveBeenCalled();
    expect(mocks.page.setViewportSize).toHaveBeenCalledWith({ width: 1280, height: 800 });

    // Navigates to localhost for relative URLs
    const calls = mocks.page.goto.mock.calls.map((c) => c[0]);
    expect(calls).toEqual([
      "http://localhost:3000/index.html",
      "http://localhost:3000/about.html",
      "http://localhost:3000/products/list.html",
    ]);

    // Creates output dirs recursively and writes files in workspace
    expect(mocks.mkdir).toHaveBeenCalledWith(path.resolve("/workspace", "out"), { recursive: true });
    expect(mocks.sharpInstance.toFile).toHaveBeenCalledTimes(3);

    // Outputs set via logger
    const outputLogs = mocks.pinoInstance.info.mock.calls.map((c) => String(c[0]));
    expect(outputLogs.some((s) => s.startsWith("::set-output name=screenshot_paths::"))).toBe(true);
    expect(outputLogs.some((s) => s.startsWith("::set-output name=screenshot_path::"))).toBe(true);

    // Server closed in finally
    expect(mocks.httpServer.close).toHaveBeenCalled();
  });

  test("Does not start server for absolute URLs; keeps URLs as-is", async () => {
    const mocks = buildMocks();
    await withMockedModules(
      {
        fs: () => ({ promises: { mkdir: mocks.mkdir } }),
        playwright: () => ({ chromium: mocks.chromium }),
        sharp: () => mocks.sharp,
        polka: () => mocks.polka,
        sirv: () => mocks.sirv,
        pino: () => mocks.pino,
      },
      () => {
        process.env.SCREENSHOTS = "https://example.com/=out/a.webp, http://foo.bar/page=out/b.jpg";
        require(path.resolve(process.cwd(), "screenshot.js"));
      },
    );

    // No local server
    expect(mocks.polka).not.toHaveBeenCalled();

    // Absolute URLs untouched
    const calls = mocks.page.goto.mock.calls.map((c) => c[0]);
    expect(calls).toEqual(["https://example.com/", "http://foo.bar/page"]);
  });

  test("Respects INPUT_PORT for local server URLs", async () => {
    const mocks = buildMocks();
    await withMockedModules(
      {
        fs: () => ({ promises: { mkdir: mocks.mkdir } }),
        playwright: () => ({ chromium: mocks.chromium }),
        sharp: () => mocks.sharp,
        polka: () => mocks.polka,
        sirv: () => mocks.sirv,
        pino: () => mocks.pino,
      },
      () => {
        process.env.SCREENSHOTS = "/=a.webp";
        process.env.INPUT_PORT = "4321";
        require(path.resolve(process.cwd(), "screenshot.js"));
      },
    );

    expect(mocks.app.listen).toHaveBeenCalledWith(4321, "0.0.0.0", expect.any(Function));
    expect(mocks.page.goto).toHaveBeenCalledWith("http://localhost:4321/", expect.any(Object));
  });

  test('Defaults to "/=screenshot.webp" when SCREENSHOTS is not set', async () => {
    const mocks = buildMocks();
    await withMockedModules(
      {
        fs: () => ({ promises: { mkdir: mocks.mkdir } }),
        playwright: () => ({ chromium: mocks.chromium }),
        sharp: () => mocks.sharp,
        polka: () => mocks.polka,
        sirv: () => mocks.sirv,
        pino: () => mocks.pino,
      },
      () => {
        delete process.env.SCREENSHOTS;
        require(path.resolve(process.cwd(), "screenshot.js"));
      },
    );

    expect(mocks.page.goto).toHaveBeenCalledWith("http://localhost:3000/", expect.any(Object));
    expect(mocks.sharpInstance.toFile).toHaveBeenCalledWith(path.resolve("/workspace", "screenshot.webp"));
  });

  test("Resolves output paths under workspace and picks format + options by extension", async () => {
    const mocks = buildMocks();
    await withMockedModules(
      {
        fs: () => ({ promises: { mkdir: mocks.mkdir } }),
        playwright: () => ({ chromium: mocks.chromium }),
        sharp: () => mocks.sharp,
        polka: () => mocks.polka,
        sirv: () => mocks.sirv,
        pino: () => mocks.pino,
      },
      () => {
        process.env.SCREENSHOTS = "/=a.png, /=b.jpg, /=c.webp";
        process.env.INPUT_WEBP_OPTIONS = '{"quality":90}';
        process.env.INPUT_PNG_OPTIONS = '{"quality":95}';
        process.env.INPUT_JPEG_OPTIONS = '{"quality":85}';
        require(path.resolve(process.cwd(), "screenshot.js"));
      },
    );

    const outCalls = mocks.sharpInstance.toFile.mock.calls.map((c) => c[0]);
    expect(outCalls).toEqual([
      path.resolve("/workspace", "a.png"),
      path.resolve("/workspace", "b.jpg"),
      path.resolve("/workspace", "c.webp"),
    ]);

    expect(mocks.sharpInstance.png).toHaveBeenCalledWith({ quality: 95 });
    expect(mocks.sharpInstance.jpeg).toHaveBeenCalledWith({ quality: 85 });
    expect(mocks.sharpInstance.webp).toHaveBeenCalledWith({ quality: 90 });
  });

  test("Toggles fullPage false when INPUT_HEIGHT is set, true otherwise", async () => {
    const mocks = buildMocks();
    // First run without height
    await withMockedModules(
      {
        fs: () => ({ promises: { mkdir: mocks.mkdir } }),
        playwright: () => ({ chromium: mocks.chromium }),
        sharp: () => mocks.sharp,
        polka: () => mocks.polka,
        sirv: () => mocks.sirv,
        pino: () => mocks.pino,
      },
      () => {
        process.env.SCREENSHOTS = "/=a.webp";
        require(path.resolve(process.cwd(), "screenshot.js"));
      },
    );
    expect(mocks.page.screenshot).toHaveBeenLastCalledWith({ fullPage: true });

    // Second run with height
    const mocks2 = buildMocks();
    await withMockedModules(
      {
        fs: () => ({ promises: { mkdir: mocks2.mkdir } }),
        playwright: () => ({ chromium: mocks2.chromium }),
        sharp: () => mocks2.sharp,
        polka: () => mocks2.polka,
        sirv: () => mocks2.sirv,
        pino: () => mocks2.pino,
      },
      () => {
        process.env.SCREENSHOTS = "/=a.webp";
        process.env.INPUT_HEIGHT = "900";
        require(path.resolve(process.cwd(), "screenshot.js"));
      },
    );
    expect(mocks2.page.setViewportSize).toHaveBeenCalledWith({ width: 1280, height: 900 });
    expect(mocks2.page.screenshot).toHaveBeenLastCalledWith({ fullPage: false });
  });
});
