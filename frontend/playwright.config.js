import fs from "node:fs";
import { defineConfig } from "@playwright/test";
import { ARTIFACTS_DIR, WEB_ORIGIN } from "./e2e/support/env.js";

fs.mkdirSync(ARTIFACTS_DIR, { recursive: true });

export default defineConfig({
  testDir: "./e2e/specs",
  timeout: 90_000,
  expect: { timeout: 15_000 },
  fullyParallel: false,
  workers: 1,
  retries: 0,
  reporter: [
    ["list"],
    ["json", { outputFile: `${ARTIFACTS_DIR}/resultados.json` }],
    ["html", { outputFolder: `${ARTIFACTS_DIR}/reporte-html`, open: "never" }],
  ],
  globalSetup: "./e2e/global-setup.js",
  globalTeardown: "./e2e/global-teardown.js",
  use: {
    baseURL: WEB_ORIGIN,
    channel: "chrome",
    headless: true,
    viewport: { width: 1440, height: 900 },
    screenshot: "only-on-failure",
    trace: "off",
    actionTimeout: 15_000,
  },
});
