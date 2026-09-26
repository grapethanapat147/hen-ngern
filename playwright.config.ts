import { defineConfig, devices } from "@playwright/test";

// Cloud sandboxes ship a pinned Chromium; locally Playwright uses its own download.
const executablePath = process.env.PLAYWRIGHT_CHROMIUM_PATH;
const PORT = 3100;

export default defineConfig({
  testDir: "e2e",
  fullyParallel: true,
  // CI keeps an HTML report as a build artifact when something fails.
  reporter: process.env.CI ? [["list"], ["html", { open: "never" }]] : "list",
  use: {
    baseURL: `http://localhost:${PORT}`,
    launchOptions: executablePath ? { executablePath } : undefined,
  },
  projects: [
    { name: "mobile-390", use: { ...devices["Desktop Chrome"], viewport: { width: 390, height: 844 }, hasTouch: true } },
    { name: "desktop-1280", use: { ...devices["Desktop Chrome"], viewport: { width: 1280, height: 800 } } },
  ],
  webServer: {
    command: `bun run build && bun run start -p ${PORT}`,
    url: `http://localhost:${PORT}`,
    reuseExistingServer: !process.env.CI,
    timeout: 180_000,
  },
});
