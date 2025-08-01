# 📸 Screenshot GitHub Action

This action:

1. Starts a local server
2. Opens it with Playwright
3. Captures a full-page WebP screenshot
4. Commits it back to the repo

## 🚀 How to Use

To automatically capture screenshots of your GitHub Pages site after each deployment, add this workflow to your repository:

```yaml
name: Auto Screenshot After GitHub Pages Deployment

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

      - name: Install dependencies
        run: |
          npm install
          npx playwright install --with-deps

      - name: Run Screenshot Generator
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
|-------|-------------|----------|---------|
| `url` | URL to capture (e.g., http://localhost:5000) | Yes | - |
| `output` | Path where the screenshot will be saved | No | `screenshot.webp` |

## 📋 Requirements

- Your project must have Node.js dependencies installed
- Playwright is used for capturing screenshots
