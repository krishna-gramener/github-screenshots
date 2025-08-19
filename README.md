# 📸 GitHub Screenshot Action

A lightweight GitHub Action that captures screenshots of websites and web applications using modern libraries.

## What This Action Does

1. Takes screenshots of specified URL paths (both local and external URLs)
2. Automatically starts a minimal HTTP server for local paths when needed
3. Saves screenshots to specified output paths in multiple formats (WebP, PNG, JPEG)
4. Works in any GitHub workflow with minimal configuration

## Basic Usage

Add this to your GitHub workflow file:

```yaml
jobs:
  screenshot:
    - name: Take Screenshot
      uses: krishna-gramener/github-screenshots@v1.0
      with:
        # Take a screenshot of the home page, /index.html, at screenshot.webp
        screenshots: /index.html=docs/screenshot.webp
```

## Examples

### Local HTML Files

```yaml
jobs:
  screenshot:
    - name: Screenshot local files
      uses: krishna-gramener/github-screenshots@v1.0
      with:
        # The URL "/" is the same as /index.html
        screenshots: /=docs/screenshot.webp
```

### Multi-line Syntax (commas or newlines)

```yaml
jobs:
  screenshot:
    - name: Screenshot multiple pages
      uses: krishna-gramener/github-screenshots@v1.0
      with:
        screenshots: |
          /index.html=docs/screenshot.webp,
          /about.html=docs/about.png,
          /products/list.html=products-list.webp
```

Notes on separators and whitespace:

- Accepts commas OR newlines between pairs; surrounding spaces/tabs are ignored.
- Trailing commas and blank lines are ignored.
- Mix-and-match commas and newlines freely.

Alternate valid formats:

```yaml
# Single line, comma-separated
screenshots: "/index.html=home.webp,/docs/about.html=about.png,/products/list.html=products.webp"

# Newlines, no commas
screenshots: |
  /index.html=home.webp
  /docs/about.html=about.png
  /products/list.html=products.webp

# Mixed with trailing commas and blank lines
screenshots: |
  /index.html=home.webp,

  /docs/about.html=about.png,
  /products/list.html=products.webp
```

### External Websites

```yaml
jobs:
  screenshot:
    - name: Screenshot external sites
      uses: krishna-gramener/github-screenshots@v1.0
      with:
        screenshots: |
          https://example.com/=example.webp,
          https://github.com/=github.png
```

### Custom Options

```yaml
jobs:
  screenshot:
    - name: Screenshot with options
      uses: krishna-gramener/github-screenshots@v1.0
      with:
        screenshots: "/index.html=docs/screenshot.webp"
        width: 1440
        height: 900
        webp_options: '{"quality":90}'
```

## Workflow Example

```yaml
name: Take Screenshots

on:
  push:
    branches: [main]
  workflow_dispatch:

# Required if GITHUB_TOKEN defaults to read-only permission
permissions:
  contents: write

jobs:
  screenshot:
    runs-on: ubuntu-latest
    steps:
      - name: Checkout code
        uses: actions/checkout@v3

      - name: Cache Playwright browsers
        uses: actions/cache@v4
        with:
          path: ~/.cache/ms-playwright
          key: playwright-${{ runner.os }}-chromium

      - name: Use Node with npm cache for faster installs
        uses: actions/setup-node@v4
        with:
          node-version: "20"
          cache: "npm"

      - name: Take Screenshot
        id: screenshots
        uses: krishna-gramener/github-screenshots@v1.0
        with:
          screenshots: "/index.html=docs/screenshot.webp"

      - name: Commit screenshots
        run: |
          git config --global user.name 'GitHub Actions'
          git config --global user.email 'actions@github.com'
          git add docs/screenshot.webp
          git commit -m "Add screenshot" || echo "No changes"
          git push
```

Notes:

- The action creates missing directories automatically (e.g. `docs/`).
- Caching `~/.cache/ms-playwright` reuses the Chromium browser that Playwright downloads.
- `actions/setup-node` caches npm downloads, speeding up dependency installs inside the action.

To speed up without cache:

- Use WebP with lower effort: `webp_options: '{"effort":2}'` (faster encoding).
- Limit height to avoid full-page screenshots: set `height` (e.g., `height: 800`).
- Keep the number of screenshots small and combine pairs in one run (already supported).
- Prefer WebP or JPEG over PNG for faster processing, when quality allows.

## Technical Implementation

This action is built with modern, lightweight libraries to keep the codebase minimal while providing powerful functionality:

- **Playwright**: For browser automation and screenshot capture
- **Sharp**: For high-performance image processing and format conversion
- **Polka**: Minimal and fast Express-like web server (33x faster than Express)
- **Sirv**: Efficient static file serving middleware
- **Pino**: High-performance structured logging

The entire implementation is under 100 lines of code while maintaining all functionality.

## Configuration Options

| Input          | Description                                                                                                | Required | Default                           |
| -------------- | ---------------------------------------------------------------------------------------------------------- | -------- | --------------------------------- |
| `screenshots`  | Comma-separated list of URL paths and output file paths in format `/=screenshot.webp,about.html=about.png` | Yes      | `/=screenshot.webp`               |
| `width`        | Viewport width in pixels for the screenshot                                                                | No       | `1280`                            |
| `height`       | Viewport height in pixels. If specified, captures only this height; otherwise captures full page           | No       | -                                 |
| `webp_options` | JSON string with WebP format options                                                                       | No       | `{"lossless":true,"quality":100}` |
| `png_options`  | JSON string with PNG format options                                                                        | No       | `{"quality":100}`                 |
| `jpeg_options` | JSON string with JPEG format options                                                                       | No       | `{"quality":90}`                  |

## How It Works

1. The action launches a headless Chromium browser using Playwright
2. For absolute URLs (starting with http:// or https://), it navigates directly to them
3. For relative paths, it automatically starts a minimal server using Polka and Sirv to serve files from your repository
4. For each URL path and output path pair in the `screenshots` parameter:
   - It navigates to the URL and waits for the page to load
   - It takes a screenshot (full-page by default, or limited to viewport height if specified)
   - It saves the screenshot to the specified output path using Sharp for optimal image processing
5. When finished, the built-in server is automatically shut down

## Troubleshooting

### "Cannot find module 'playwright'"

This error occurs when the dependencies aren't installed correctly. We've fixed this by:

- Adding `cd ${{ github.action_path }}` in action.yml to install dependencies in the correct location
- Ensuring all dependencies (playwright, sharp, polka, sirv, pino) are installed before running the script

### Screenshots showing blank pages or errors

- Make sure your HTML files are properly formatted and all assets (CSS, JS, images) are available
- Check that the paths in your HTML files are correct (relative or absolute)
- Try increasing the wait time for complex pages

### Screenshots not showing the right content

- If using the built-in server (with relative paths), make sure your files are in the GitHub workspace directory
- If using absolute URLs with your own server, ensure it's running and accessible at those URLs
- Make sure the URL paths in the `screenshots` parameter are correct
- Screenshots are saved to your GitHub workspace directory where git commands can find them

### Common Issues

- **Blank screenshots**: Ensure HTML files and assets are properly loaded
- **Server issues**: Default port is 3000, specify different port if needed
- **Missing dependencies**: Action installs dependencies automatically

## Action Outputs

This action sets the following outputs that you can use in subsequent steps:

- `screenshot_paths`: Comma-separated list of all screenshot file paths
- `screenshot_path`: Path to the first screenshot (for convenience)

```yaml
jobs:
  screenshot:
    - name: Take Screenshots
      id: screenshots  # Add an ID to reference outputs
      uses: krishna-gramener/github-screenshots@v1.0
      with:
        screenshots: "/=screenshot.png"

    - name: Use Screenshot Path
      run: echo "Screenshot saved at: ${{ steps.screenshots.outputs.screenshot_path }}"
```

### Using Screenshot Outputs

```yaml
jobs:
  screenshot:
    - name: Upload Screenshots
      uses: actions/upload-artifact@v3
      with:
        name: screenshots
        path: ${{ steps.screenshots.outputs.screenshot_paths }}
```

Available outputs:

- `screenshot_path`: Path to the first screenshot
- `screenshot_paths`: Comma-separated list of paths to all screenshots

## Format-Specific Options

- **WebP options**: [Sharp WebP documentation](https://sharp.pixelplumbing.com/api-output#webp)
  - Example: `{"lossless":true,"quality":100,"effort":6}`
- **PNG options**: [Sharp PNG documentation](https://sharp.pixelplumbing.com/api-output#png)
  - Example: `{"quality":100}`
- **JPEG options**: [Sharp JPEG documentation](https://sharp.pixelplumbing.com/api-output#jpeg)
  - Example: `{"quality":90,"progressive":true}`
