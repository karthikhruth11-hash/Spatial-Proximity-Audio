import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "./e2e",
  fullyParallel: false,
  workers: 1,
  reporter: [["list"]],
  timeout: 60000,
  use: {
    baseURL: "http://127.0.0.1:3000",
    trace: "on-first-retry",
  },
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
  ],
  webServer: [
    {
      command: "node ../server/dist/index.js",
      url: "http://127.0.0.1:4000/api/health",
      reuseExistingServer: true,
      env: {
        PORT: "4000",
        NODE_ENV: "test",
        MONGODB_URI: "mongodb://127.0.0.1:27017/proxispeak-test",
        REDIS_URL: "redis://127.0.0.1:6379",
        JWT_SECRET: "proxispeak_jwt_secret_dev_32characters_min",
        CLIENT_ORIGIN: "http://127.0.0.1:3000",
      },
      timeout: 20000,
    },
    {
      command: "pnpm run preview --port 3000 --host 127.0.0.1",
      url: "http://127.0.0.1:3000",
      reuseExistingServer: true,
      timeout: 20000,
    },
  ],
});
