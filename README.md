# 📸 GitHub Screenshot Action

A GitHub Action that captures screenshots of websites and web applications.

## What This Action Does

1. Takes screenshots of specified URL paths
2. Automatically starts a built-in HTTP server for local paths when needed
3. Saves screenshots to specified output paths in multiple formats (WebP, PNG, JPEG)
4. Works in any GitHub workflow

## Basic Usage

Add this to your GitHub workflow file:

```yaml
- name: Take Screenshot
  uses: krishna-gramener/github-screenshots@v1.0
  with:
    screenshots: "/=screenshot.webp,about.html=about.png"
```

## Examples

### Local HTML Files
```yaml
- name: Screenshot local files
  uses: krishna-gramener/github-screenshots@v1.0
  with:
    screenshots: "/index.html=home.webp,/docs/about.html=about.png"
```

### External Websites
```yaml
- name: Screenshot external sites
  uses: krishna-gramener/github-screenshots@v1.0
  with:
    screenshots: "https://example.com/=example.webp,https://github.com/=github.png"
```

### Custom Options
```yaml
- name: Screenshot with options
  uses: krishna-gramener/github-screenshots@v1.0
  with:
    screenshots: "/dashboard.html=dashboard.webp"
    width: 1440
    height: 900
    webp_options: '{"quality":90}'
```

## Workflow Example

```yaml
name: Take Screenshots

on:
  push:
    branches: [ main ]
  workflow_dispatch:

jobs:
  screenshot:
    runs-on: ubuntu-latest
    steps:
      - name: Checkout code
        uses: actions/checkout@v3
        
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

## Configuration Options

| Input | Description | Required | Default |
|-------|-------------|----------|--------|
| `screenshots` | Comma-separated list of URL paths and output file paths in format `/=screenshot.webp,about.html=about.png` | Yes | `/=screenshot.webp` |
| `width` | Viewport width in pixels for the screenshot | No | `1280` |
| `height` | Viewport height in pixels. If specified, captures only this height; otherwise captures full page | No | - |
| `webp_options` | JSON string with WebP format options | No | `{"lossless":true,"quality":100,"effort":6}` |
| `png_options` | JSON string with PNG format options | No | `{"quality":100}` |
| `jpeg_options` | JSON string with JPEG format options | No | `{"quality":90}` |

## How It Works

1. The action launches a headless Chromium browser using Playwright
2. For absolute URLs (starting with http:// or https://), it navigates directly to them
3. For relative paths, it automatically starts a built-in HTTP server to serve files from your repository
4. For each URL path and output path pair in the `screenshots` parameter:
   - It navigates to the URL and waits for the page to load
   - It takes a screenshot (full-page by default, or limited to viewport height if specified)
   - It saves the screenshot to the specified output path in the appropriate format based on file extension
5. When finished, the built-in server is automatically shut down

## Examples

### Basic Example

```yaml
- name: Take Screenshot
  uses: krishna-gramener/github-screenshots@v1.0
  with:
    screenshots: "/=screenshot.webp"
```

## Troubleshooting

### "Cannot find module 'playwright'"

This error occurs when the dependencies aren't installed correctly. We've fixed this by:
- Adding `cd ${{ github.action_path }}` in action.yml to install dependencies in the correct location
- Ensuring all dependencies (playwright, sharp, mime-types) are installed before running the script

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
