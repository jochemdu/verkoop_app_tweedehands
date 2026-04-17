import { defineConfig, devices } from "@playwright/test";

// E2E config. Default: test productie-deploy (live Vercel URL). Override met
// `PLAYWRIGHT_BASE_URL=http://localhost:3000` voor lokale smoke tests.

const baseURL = process.env.PLAYWRIGHT_BASE_URL ?? "https://verkoopassistent.vercel.app";

export default defineConfig({
  testDir: "./tests/e2e",
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: process.env.CI ? [["github"], ["list"]] : "list",
  use: {
    baseURL,
    trace: "on-first-retry",
    screenshot: "only-on-failure",
  },
  projects: [
    { name: "chromium", use: { ...devices["Desktop Chrome"] } },
  ],
});
