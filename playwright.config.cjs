const { defineConfig } = require("@playwright/test");

module.exports = defineConfig({
  testDir: "./tests/e2e",
  timeout: 30000,
  expect: { timeout: 5000 },
  use: {
    baseURL: "http://127.0.0.1:4174",
    headless: true,
  },
  webServer: {
    command: "python3 -m http.server 4174 --directory apps/webview-demo/dist",
    url: "http://127.0.0.1:4174",
    reuseExistingServer: true,
    timeout: 30000,
  },
});
