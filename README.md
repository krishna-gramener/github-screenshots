# 📸 GitHub Screenshot Action

A GitHub Action that captures screenshots of websites and web applications.

## What This Action Does

1. Takes screenshots of specified URLs
2. Starts a local server automatically for localhost URLs
3. Saves screenshots in multiple formats (WebP, PNG, JPEG)
4. Works in any GitHub workflow

## Basic Usage

Add this to your GitHub workflow file:

```yaml
- name: Take Screenshot
  uses: krishna-gramener/github-screenshots@v1.0
  with:
    url: https://example.com
    output: screenshot.png
```

## Configuration Options

| Input | Description | Required | Default |
|-------|-------------|----------|--------|
| `url` | URL or comma-separated list of URLs to capture | No | `http://localhost:5000` |
| `output` | Path where screenshot will be saved, or comma-separated list of output paths | No | `screenshot.webp` |
| `width` | Viewport width in pixels for the screenshot | No | `1280` |
| `height` | Viewport height in pixels. If specified, captures only this height; otherwise captures full page | No | - |
| `webp_options` | JSON string with WebP format options | No | `{"lossless":true,"quality":100,"effort":6}` |
| `png_options` | JSON string with PNG format options | No | `{"quality":100}` |
| `jpeg_options` | JSON string with JPEG format options | No | `{"quality":90}` |

## How It Works

1. If the URL contains `localhost` or `127.0.0.1`, the action starts a local server using the `serve` package
2. The action launches a headless Chromium browser using Playwright
3. It navigates to the specified URL(s) and waits for the page to load
4. It takes a screenshot (full-page by default, or limited to viewport height if specified)
5. The screenshot is saved to the specified output path(s) in the appropriate format
6. If a local server was started, it is shut down

## Examples

### Complete Workflow Implementation

Here's a complete workflow file that builds a site, takes screenshots, and commits them back to the repository:

```yaml
name: Update Documentation Screenshots

on:
  # Run on push to main branch
  push:
    branches: ["main"]
  # Allow manual trigger
  workflow_dispatch:

jobs:
  screenshot:
    runs-on: ubuntu-latest
    permissions:
      contents: write  # Needed to commit back to the repo
      
    steps:
      # Check out your repository code
      - uses: actions/checkout@v3
      
      # Setup Node.js environment
      - name: Setup Node.js
        uses: actions/setup-node@v3
        with:
          node-version: '18'
          
      # Install dependencies and build site
      - name: Install dependencies
        run: npm ci
        
      - name: Build site
        run: npm run build
      
      # Take screenshots
      - name: Capture Screenshots
        id: screenshots
        uses: krishna-gramener/github-screenshots@v1.0
        with:
          # Multiple URLs (both local and remote)
          url: http://localhost:5000,http://localhost:5000/dashboard,https://example.com
          
          # Save screenshots to docs folder with different formats
          output: docs/images/home.webp,docs/images/dashboard.png,docs/images/example.jpg
          
          # Custom viewport size
          width: 1440
          
          # Format-specific options
          webp_options: '{"quality":90,"effort":4}'
          png_options: '{"quality":95}'
          jpeg_options: '{"quality":85,"progressive":true}'
      
      # Commit and push the screenshots
      - name: Commit Screenshots
        run: |
          git config user.name "github-actions"
          git config user.email "github-actions@github.com"
          git add docs/images/
          git commit -m "📸 Update documentation screenshots" || echo "No changes to commit"
          git push
```

### Local vs Remote Screenshots

#### Remote Screenshots

```yaml
- name: Take screenshot of external site
  uses: krishna-gramener/github-screenshots@v1.0
  with:
    url: https://example.com
    output: external-screenshot.png
```

#### Local Screenshots (with auto-server)

```yaml
- name: Take screenshot of local site
  uses: krishna-gramener/github-screenshots@v1.0
  with:
    url: http://localhost:5000
    output: local-screenshot.webp
```

When using localhost URLs, the action automatically:
- Starts a local server on the specified port (5000 in this example)
- Serves files from your GitHub workspace directory
- Takes the screenshot
- Shuts down the server

### Multiple Screenshots in One Run

```yaml
- name: Take multiple screenshots
  uses: krishna-gramener/github-screenshots@v1.0
  with:
    url: http://localhost:5000,http://localhost:5000/about,https://example.com
    output: home.webp,about.png,external.jpg
    width: 1440
    webp_options: '{"quality":90,"effort":4}'
    png_options: '{"quality":95}'
    jpeg_options: '{"quality":85,"progressive":true}'
```

This will:
- Take screenshots of three different URLs (two local, one remote)
- Save them in three different formats with custom quality settings
- Use the same viewport width (1440px) for all screenshots

## Additional Notes

- For local URLs, the action extracts the port from the URL (e.g., `http://localhost:8080` will use port 8080)
- If no port is specified, the default port 5000 is used
- Multiple screenshots can be taken by providing comma-separated lists of URLs and output filenames
- If fewer output filenames than URLs are provided, additional filenames are generated automatically
- The format is determined by the file extension in your `output` parameter:
  - `.webp` - Best quality-to-size ratio (default)
  - `.png` - Lossless quality but larger files
  - `.jpg` or `.jpeg` - Smaller files but lossy compression

## Troubleshooting

### "Cannot find module 'playwright'"

This error occurs when the dependencies aren't installed correctly. We've fixed this by:
- Adding `cd ${{ github.action_path }}` in action.yml to install dependencies in the correct location
- Ensuring all dependencies (playwright, sharp, serve) are installed before running the script

### "Error: Unknown --listen endpoint scheme"

This error happens when the serve command's listen parameter is incorrectly formatted. Fixed by:

- Using the proper format for the listen endpoint: `--listen :${port}` instead of `-l port`
- Ensuring the port is properly extracted from the URL

### Screenshots not showing the right content

- For local sites, ensure your files are properly built before taking screenshots
- The action serves files from your GitHub workspace directory (GITHUB_WORKSPACE)
- Screenshots are saved to your GitHub workspace directory where git commands can find them

## Action Outputs

The action sets output variables you can use in subsequent steps:

```yaml
- name: Take Screenshots
  id: screenshots  # Add an ID to reference outputs
  uses: krishna-gramener/github-screenshots@v1.0
  with:
    url: http://localhost:5000
    output: screenshot.png

- name: Use Screenshot Path
  run: echo "Screenshot saved at: ${{ steps.screenshots.outputs.screenshot_path }}"
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
