import { defineConfig, devices } from "@playwright/test";

const PORT = Number(process.env.E2E_PORT ?? 3100);

/**
 * Smoke test of the main flows against a production build.
 * AI and transcription run in mock mode, so no API keys are needed.
 * Needs DATABASE_URL and SESSION_SECRET, and `npm run build` first.
 */
export default defineConfig({
  testDir: "./e2e",
  timeout: 90_000,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [["github"], ["list"]] : "list",
  use: {
    baseURL: `http://localhost:${PORT}`,
    trace: process.env.CI ? "retain-on-failure" : "off",
    permissions: ["microphone"],
    launchOptions: { args: ["--use-fake-ui-for-media-stream", "--use-fake-device-for-media-stream"] },
  },
  projects: [
    { name: "desktop", use: { ...devices["Desktop Chrome"] } },
    { name: "phone", use: { ...devices["Pixel 7"] } },
  ],
  webServer: {
    command: `npx next start -p ${PORT}`,
    url: `http://localhost:${PORT}/login`,
    reuseExistingServer: !process.env.CI,
    timeout: 60_000,
    env: { SPEAKEASY_MOCK_AI: "1", SPEAKEASY_MOCK_TRANSCRIPTION: "1" },
  },
});
