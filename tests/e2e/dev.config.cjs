// Playwright config that targets the running Vite dev server (no webServer
// auto-start). Used by `cursor-jump-dev.spec.cjs` to reproduce timing-
// dependent regressions that only show up under HMR.
const { defineConfig } = require("@playwright/test");

module.exports = defineConfig({
  testDir: "./",
  testMatch: /cursor-jump-dev\.spec\.cjs$/,
  timeout: 30000,
  expect: { timeout: 5000 },
  use: {
    baseURL: "http://localhost:5173",
    headless: true,
  },
});
