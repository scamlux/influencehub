import { defineConfig, devices } from "@playwright/test";

// E2E smoke suite runs against the offline mock layer (VITE_USE_MOCK_DATA=true)
// so no Supabase backend is required — the seed in src/lib/mock-data.ts backs
// every flow. Each test gets a fresh browser context (fresh localStorage seed).
export default defineConfig({
  testDir: "./e2e",
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: process.env.CI ? [["list"], ["html", { open: "never" }]] : "list",
  use: {
    // Dedicated port so a stray dev server on Vite's default 5173 can't shadow
    // the mock-mode server this suite needs.
    baseURL: "http://localhost:4321",
    trace: "on-first-retry",
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
  webServer: {
    command: "npm run dev -- --port 4321 --strictPort",
    url: "http://localhost:4321",
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
    env: { VITE_USE_MOCK_DATA: "true" },
  },
});
