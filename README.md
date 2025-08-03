# 📸 Screenshot GitHub Action

This action:

1. Starts a local server (if using localhost URL)
2. Opens the URL with Playwright
3. Captures a full-page WebP screenshot
4. Saves it to your GitHub workspace

## 🚀 How to Use

To automatically capture screenshots of your site and commit them back to your repository, add this workflow:

```yaml
name: Auto Screenshot

on:
  push:
    branches: ["main"]

jobs:
  screenshot:
    runs-on: ubuntu-latest
    permissions:
      contents: write

    steps:
      - uses: actions/checkout@v3

      - name: Setup Node
        uses: actions/setup-node@v3
        with:
          node-version: "18"

      - name: Take Screenshot
        uses: krishna-gramener/github-screenshots@v1
        with:
          url: http://localhost:5000
          output: screenshot.webp

      - name: Commit screenshot
        run: |
          git config user.name "github-actions"
          git config user.email "github-actions@github.com"
          git add screenshot.webp
          git commit -m "📸 Screenshot updated" || echo "No changes"
          git push
```

## ⚙️ Configuration

The action accepts the following inputs:

| Input | Description | Required | Default |
|-------|-------------|----------|--------|
| `url` | URL to capture (e.g., http://localhost:5000 or https://example.com) | Yes | - |
| `output` | Path where the screenshot will be saved | No | `screenshot.webp` |

## 🔍 How It Works

- If the URL contains `localhost` or `127.0.0.1`, the action automatically starts a local server using the `serve` package
- The server serves files from your GitHub workspace directory (`GITHUB_WORKSPACE`)
- Screenshots are saved to your GitHub workspace directory, making them accessible for git operations
- The action uses Playwright to capture high-quality WebP screenshots with lossless compression

## 📋 Requirements

- No external dependencies needed! The action automatically installs:
  - Playwright (for browser automation)
  - Sharp (for image processing)
  - Serve (for local server if needed)

## 🔧 Troubleshooting

If you encounter issues:

1. Make sure your workflow has proper permissions (`contents: write` if committing back to the repo)
2. For local URLs, ensure your files are properly built before taking the screenshot
3. Allow sufficient time for your server to start (the action waits 5 seconds by default)

## 📝 Notes

- Screenshots are saved as WebP files with lossless compression for optimal quality and size
- The action sets an output variable `screenshot_path` with the full path to the saved screenshot
