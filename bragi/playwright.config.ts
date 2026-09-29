import { defineConfig } from "@playwright/test";
export default defineConfig({
  testDir: "test",
  testMatch: "**/*.browser.ts",
  use: { headless: true },
  workers: 1,
});
