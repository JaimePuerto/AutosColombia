// Configuración dedicada al benchmark de rendimiento (RNF-03 / H-08).
//
// Se mantiene separada de `playwright.config.js` para no mezclar la medición de
// rendimiento con la puerta funcional M-01…M-18. Reutiliza el mismo arnés aislado:
// base efímera `autoscolombia_e2e_<pid>`, backend en 3311 y datos sintéticos.

import fs from "node:fs";
import { defineConfig } from "@playwright/test";
import { ARTIFACTS_DIR } from "./e2e/support/env.js";

fs.mkdirSync(ARTIFACTS_DIR, { recursive: true });

export default defineConfig({
  testDir: "./e2e/rendimiento",
  timeout: 600_000,
  fullyParallel: false,
  workers: 1,
  retries: 0,
  reporter: [
    ["list"],
    ["json", { outputFile: `${ARTIFACTS_DIR}/resultados-rendimiento.json` }],
  ],
  globalSetup: "./e2e/global-setup.js",
  globalTeardown: "./e2e/global-teardown.js",
  use: {
    channel: "chrome",
    headless: true,
  },
});
