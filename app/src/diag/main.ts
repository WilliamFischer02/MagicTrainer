import { invoke } from "@tauri-apps/api/core";
import { cardImageSrc, ImageCacheStatusSchema } from "../bridge/images";
import { CombosEnvelopeSchema } from "../bridge/spellbook";

/**
 * Dev-only diagnostics page (`/diag.html`), run inside the real Tauri window:
 *   1. loads two Scryfall images through the `mtimg` protocol twice (miss → hit),
 *   2. asks Commander Spellbook `find-my-combos` twice (network → disk cache),
 *   3. POSTs a JSON report to `?collector=` and closes the window on `&autoclose=1`.
 * Usage: `npx tauri dev --config '{"build":{"devUrl":"http://localhost:1420/diag.html?collector=http://localhost:1421/report&autoclose=1"}}'`
 */

const IMAGES = [
  // Sanguine Bond / Exquisite Blood art crops (from the bundled Spellbook sample).
  "https://cards.scryfall.io/art_crop/front/a/d/ad4de9f1-7a39-45af-828e-c59234d9e9b9.jpg?1783927550",
  "https://cards.scryfall.io/art_crop/front/0/e/0e8ccfa7-4178-476a-a155-0ca1c98556c9.jpg?1783913874",
];

type ImageResult = { url: string; src: string; ok: boolean; ms: number; width: number; height: number };
type Report = {
  tauri: boolean;
  images: { first: ImageResult[]; second: ImageResult[]; cacheBefore: unknown; cacheAfter: unknown };
  combos: { first: unknown; second: unknown; error?: string };
  passed: boolean;
  failures: string[];
};

const log = document.getElementById("log") as HTMLPreElement;
const imgs = document.getElementById("imgs") as HTMLDivElement;
const lines: string[] = [];
function say(s: string) {
  lines.push(s);
  log.textContent = lines.join("\n");
  console.log(`[DIAG] ${s}`);
}

function loadImage(url: string, bust: string): Promise<ImageResult> {
  return new Promise((resolve) => {
    const src = cardImageSrc(url) ?? url;
    const img = new Image();
    const t0 = performance.now();
    img.decoding = "async";
    img.onload = () => resolve({ url, src, ok: true, ms: Math.round(performance.now() - t0), width: img.naturalWidth, height: img.naturalHeight });
    img.onerror = () => resolve({ url, src, ok: false, ms: Math.round(performance.now() - t0), width: 0, height: 0 });
    img.alt = `${bust} ${url}`;
    imgs.append(img);
    img.src = src;
  });
}

async function main() {
  const q = new URLSearchParams(location.search);
  const tauri = "__TAURI_INTERNALS__" in window;
  const failures: string[] = [];
  say(`tauri: ${tauri}`);

  const cacheBefore = tauri ? ImageCacheStatusSchema.parse(await invoke("image_cache_status")) : null;
  say(`image cache before: ${JSON.stringify(cacheBefore)}`);
  const first = await Promise.all(IMAGES.map((u) => loadImage(u, "1st")));
  for (const r of first) say(`1st ${r.ok ? "OK " : "ERR"} ${r.ms} ms ${r.width}x${r.height} ${r.src}`);
  const second = await Promise.all(IMAGES.map((u) => loadImage(u, "2nd")));
  for (const r of second) say(`2nd ${r.ok ? "OK " : "ERR"} ${r.ms} ms ${r.width}x${r.height} ${r.src}`);
  const cacheAfter = tauri ? ImageCacheStatusSchema.parse(await invoke("image_cache_status")) : null;
  say(`image cache after: ${JSON.stringify(cacheAfter)}`);
  if (!first.every((r) => r.ok && r.width > 0)) failures.push("first image load failed");
  if (!second.every((r) => r.ok && r.width > 0)) failures.push("second image load failed");
  if (tauri && !first.every((r) => r.src.startsWith("http://mtimg.localhost/"))) failures.push("src not rewritten to mtimg");
  if (cacheBefore && cacheAfter && cacheAfter.files < IMAGES.length) failures.push(`cache has ${cacheAfter.files} files, expected ≥ ${IMAGES.length}`);

  const combos: Report["combos"] = { first: null, second: null };
  if (tauri) {
    const req = {
      main: [
        { card: "Exquisite Blood", quantity: 1 },
        { card: "Sanguine Bond", quantity: 1 },
        { card: "Swamp", quantity: 30 },
      ],
      commanders: [],
      forceRefresh: true,
    };
    try {
      const a = CombosEnvelopeSchema.parse(await invoke("find_my_combos", req));
      const b = CombosEnvelopeSchema.parse(await invoke("find_my_combos", { ...req, forceRefresh: false }));
      combos.first = { cached: a.cached, stale: a.stale, included: a.results.included.map((v) => v.id), almost: a.results.almostIncluded.length, fetchedAt: a.fetchedAt };
      combos.second = { cached: b.cached, stale: b.stale, included: b.results.included.map((v) => v.id), key: b.key };
      say(`combos 1st: ${JSON.stringify(combos.first)}`);
      say(`combos 2nd: ${JSON.stringify(combos.second)}`);
      if (a.cached) failures.push("forced refresh reported cached");
      if (!b.cached) failures.push("second combo lookup not served from cache");
      if (!a.results.included.some((v) => v.id === "690-3966")) failures.push("Exquisite Blood + Sanguine Bond (690-3966) not found");
    } catch (e) {
      combos.error = e instanceof Error ? e.message : String(e);
      failures.push(`find_my_combos: ${combos.error}`);
      say(`combos ERR ${combos.error}`);
    }
  }

  const report: Report = { tauri, images: { first, second, cacheBefore, cacheAfter }, combos, passed: failures.length === 0, failures };
  say(report.passed ? "PASSED" : `FAILED: ${failures.join("; ")}`);
  log.className = report.passed ? "ok" : "bad";

  const collector = q.get("collector");
  if (collector) {
    try {
      await fetch(collector, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(report) });
    } catch (e) {
      console.warn("[DIAG] collector unreachable", e);
    }
  }
  if (tauri && q.get("autoclose") === "1") {
    const { getCurrentWindow } = await import("@tauri-apps/api/window");
    await getCurrentWindow().close();
  }
}

main().catch((e: unknown) => {
  say(`fatal: ${e instanceof Error ? e.stack ?? e.message : String(e)}`);
  log.className = "bad";
});
