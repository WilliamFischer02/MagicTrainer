import { spawn, type ChildProcess } from "node:child_process";
import { existsSync, mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { chromium, expect, test, type Browser, type Page } from "@playwright/test";

/**
 * Drives the built MagicTrainer.exe through WebView2's Chrome DevTools Protocol.
 * Requires an imported card DB in MT_DATA (default ../data) and the seeded sample decks
 * (`/diag.html?seed=…` from a dev run, ids `seed-<file>`). Runs serially.
 */

const __dirname = dirname(fileURLToPath(import.meta.url));
const EXE = process.env.MT_EXE ?? resolve(__dirname, "../src-tauri/target/release/magictrainer.exe");
const DATA = process.env.MT_DATA ?? resolve(__dirname, "../../data");
const PORT = 9333;
const SHOTS = resolve(__dirname, "shots");

let app: ChildProcess | undefined;
let browser: Browser | undefined;
let page: Page;

async function connect(): Promise<Browser> {
  const deadline = Date.now() + 60_000;
  let last: unknown;
  while (Date.now() < deadline) {
    try {
      return await chromium.connectOverCDP(`http://127.0.0.1:${PORT}`, { timeout: 5_000 });
    } catch (e) {
      last = e;
      await new Promise((r) => setTimeout(r, 500));
    }
  }
  throw new Error(`Could not connect to WebView2 on port ${PORT}: ${String(last)}`);
}

async function appPage(): Promise<Page> {
  const deadline = Date.now() + 30_000;
  while (Date.now() < deadline) {
    for (const ctx of browser!.contexts()) {
      for (const p of ctx.pages()) {
        const url = p.url();
        if (url.startsWith("http://tauri.localhost") || url.startsWith("tauri://") || url.startsWith("http://localhost:1420")) return p;
      }
    }
    await new Promise((r) => setTimeout(r, 300));
  }
  throw new Error("No app page found over CDP");
}

test.beforeAll(async () => {
  test.skip(!existsSync(EXE), `Built app not found at ${EXE} — run \`npm run tauri build\` first`);
  mkdirSync(SHOTS, { recursive: true });
  app = spawn(EXE, [], {
    env: {
      ...process.env,
      MAGICTRAINER_DATA_DIR: DATA,
      WEBVIEW2_ADDITIONAL_BROWSER_ARGUMENTS: `--remote-debugging-port=${PORT}`,
    },
    stdio: "ignore",
    windowsHide: false,
  });
  browser = await connect();
  page = await appPage();
  await page.waitForLoadState("domcontentloaded");
});

test.afterAll(async () => {
  await browser?.close().catch(() => undefined);
  app?.kill();
});

test("shell renders with the card database pill and the four routes", async () => {
  await expect(page.getByRole("navigation", { name: "Primary" })).toBeVisible();
  await expect(page.getByRole("button", { name: /^Open data settings/ })).toBeVisible({ timeout: 30_000 });
  for (const label of ["Decks", "Collection", "Rules", "Settings"]) {
    await expect(page.getByRole("navigation", { name: "Primary" }).getByRole("button", { name: label, exact: true })).toBeVisible();
  }
  await page.screenshot({ path: resolve(SHOTS, "01-decks.png") });
});

test("deck library lists the seeded decks and opens analysis with a strategy match", async () => {
  await page.getByRole("navigation", { name: "Primary" }).getByRole("button", { name: "Decks", exact: true }).click();
  const athreos = page.getByRole("button", { name: /Athreos Aristocrats/ }).first();
  await expect(athreos).toBeVisible({ timeout: 30_000 });
  await athreos.click();
  await expect(page.getByRole("heading", { name: /Athreos Aristocrats/ })).toBeVisible();
  await expect(page.getByText("Detected strategies")).toBeVisible();
  await expect(page.getByText(/Aristocrats \(sacrifice engine\)/).first()).toBeVisible({ timeout: 30_000 });
  await expect(page.getByText("Mana curve")).toBeVisible();
  await page.screenshot({ path: resolve(SHOTS, "02-analysis.png") });
});

test("rules search finds a rule by number and opens it in the context panel", async () => {
  await page.getByRole("navigation", { name: "Primary" }).getByRole("button", { name: "Rules", exact: true }).click();
  const search = page.getByRole("searchbox", { name: "Search the Comprehensive Rules" });
  await search.fill("603.6c");
  const hit = page.locator("button[aria-pressed]").filter({ hasText: /^603\.6c/ }).first();
  await expect(hit).toBeVisible({ timeout: 20_000 });
  await hit.click();
  const panel = page.locator("aside[aria-label='Rule detail']");
  await expect(panel).toBeVisible();
  await expect(panel).toContainText("603.6c");
  await expect(panel).toContainText(/leaves the battlefield/i);
});

test("trainer plays a line on the board with keyboard stepping", async () => {
  await page.getByRole("radio", { name: /Trainer/ }).click();
  await page.getByRole("navigation", { name: "Primary" }).getByRole("button", { name: "Decks", exact: true }).click();
  const deckSelect = page.getByRole("combobox", { name: "Deck" });
  await expect(deckSelect).toBeVisible({ timeout: 30_000 });
  const athreosValue = await deckSelect.locator("option", { hasText: "Athreos Aristocrats" }).getAttribute("value");
  await deckSelect.selectOption(athreosValue!);
  await expect(page.getByRole("combobox", { name: "Playline" })).toBeVisible();
  await expect(page.getByRole("group", { name: "Playback" })).toBeVisible();
  const slider = page.getByRole("slider", { name: "Timeline position" });
  await expect(slider).toHaveValue("0");
  await page.getByRole("button", { name: "Next step" }).click();
  await expect(slider).toHaveValue("1");
  await page.keyboard.press("ArrowRight");
  await page.keyboard.press("ArrowRight");
  await expect(slider).toHaveValue("3");
  await expect(page.getByRole("complementary", { name: "Step details" })).toBeVisible();
  await expect(page.getByText(/Your battlefield/i)).toBeVisible();
  await page.screenshot({ path: resolve(SHOTS, "03-trainer.png") });
});

test("settings shows caches, privacy switch and the diagnostics log", async () => {
  await page.getByRole("navigation", { name: "Primary" }).getByRole("button", { name: "Settings", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Caches" })).toBeVisible();
  await expect(page.getByRole("checkbox", { name: /Look up combos on Commander Spellbook automatically/ })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Diagnostics log" })).toBeVisible();
  await expect(page.getByText(/magictrainer\.log/)).toBeVisible({ timeout: 20_000 });
});

test("2× DPI render has no console errors and produces a crisp capture", async () => {
  const errors: string[] = [];
  page.on("console", (m) => {
    if (m.type() === "error") errors.push(m.text());
  });
  const session = await page.context().newCDPSession(page);
  await session.send("Emulation.setDeviceMetricsOverride", { width: 1440, height: 900, deviceScaleFactor: 2, mobile: false });
  await page.getByRole("navigation", { name: "Primary" }).getByRole("button", { name: "Decks", exact: true }).click();
  await page.waitForTimeout(1500);
  await page.screenshot({ path: resolve(SHOTS, "04-decks-2x.png") });
  await session.send("Emulation.clearDeviceMetricsOverride");
  expect(errors.filter((e) => !/favicon/i.test(e))).toEqual([]);
});
