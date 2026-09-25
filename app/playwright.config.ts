import { defineConfig } from "@playwright/test";

/**
 * E2E against the REAL built app: `e2e/app.spec.ts` launches `magictrainer.exe` with WebView2's
 * remote-debugging port enabled and connects Playwright over CDP. No browser download needed.
 *   MT_EXE   path to the executable (default: src-tauri/target/release/magictrainer.exe)
 *   MT_DATA  data dir with an imported DB (default: ../data)
 */
export default defineConfig({
  testDir: "./e2e",
  timeout: 90_000,
  expect: { timeout: 15_000 },
  fullyParallel: false,
  workers: 1,
  retries: 0,
  reporter: [["list"], ["html", { open: "never", outputFolder: "e2e/report" }]],
  outputDir: "e2e/results",
  use: { trace: "retain-on-failure" },
});
