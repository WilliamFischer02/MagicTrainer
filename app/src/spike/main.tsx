import { measure, type FpsReport } from "./fps";
import { createPixiScene, type Scene, type SceneOpts } from "./pixiScene";
import { createSvgScene } from "./svgScene";

/**
 * Throwaway board-rendering spike (ROADMAP Phase 1, D-006).
 *   /spike.html?mode=pixi|svg&dpr=1|2&sprites=150&arrows=40&seconds=10
 * Prints `[SPIKE] {...}` to the console and stores the report on `window.__spike`.
 */
declare global {
  interface Window {
    __spike?: { opts: SceneOpts & { mode: string }; label: string; report: FpsReport; devicePixelRatio: number; ua: string };
  }
}

const q = new URLSearchParams(location.search);
const mode = q.get("mode") ?? "pixi";
const opts: SceneOpts = {
  sprites: Number(q.get("sprites") ?? 150),
  arrows: Number(q.get("arrows") ?? 40),
  dpr: Number(q.get("dpr") ?? 1),
  width: 1440,
  height: 900,
};
const seconds = Number(q.get("seconds") ?? 10);

const stageEl = document.getElementById("stage");
const hudEl = document.getElementById("hud");
if (!stageEl || !hudEl) throw new Error("spike.html markup missing");
const stage: HTMLElement = stageEl;
const hud: HTMLElement = hudEl;

async function main(): Promise<void> {
  hud.textContent = `mode=${mode} dpr=${opts.dpr} sprites=${opts.sprites} arrows=${opts.arrows} … measuring ${seconds}s`;
  const scene: Scene = mode === "svg" ? createSvgScene(stage, opts) : await createPixiScene(stage, opts);
  // Warm-up: let textures upload / layout settle before timing.
  await measure(1.5, (t, dt) => scene.update(t, dt));
  const report = await measure(seconds, (t, dt) => scene.update(t + 1.5, dt));
  const result = { opts: { ...opts, mode }, label: scene.label, report, devicePixelRatio: window.devicePixelRatio, ua: navigator.userAgent };
  window.__spike = result;
  console.log("[SPIKE]", JSON.stringify(result));
  // Unattended runs: hand the report to a local collector, then close the Tauri window so
  // `tauri dev` exits and the next variant can start. No-ops in a plain browser.
  const collector = q.get("collector");
  if (collector) {
    try {
      await fetch(collector, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(result) });
    } catch (e) {
      console.warn("[SPIKE] collector unreachable", e);
    }
  }
  if ("__TAURI_INTERNALS__" in window && q.get("autoclose") === "1") {
    const { getCurrentWindow } = await import("@tauri-apps/api/window");
    await getCurrentWindow().close();
  }
  hud.textContent =
    `${scene.label}\n` +
    `sprites ${opts.sprites}  arrows ${opts.arrows}  dpr ${opts.dpr} (device ${window.devicePixelRatio})\n` +
    `fps ${report.fps}  p50 ${report.p50}ms  p95 ${report.p95}ms  p99 ${report.p99}ms  max ${report.max}ms\n` +
    `long frames ${report.longFrames}/${report.frames} over ${report.seconds}s\n` +
    `update() p50 ${report.tickP50}ms  p95 ${report.tickP95}ms`;
}

main().catch((e: unknown) => {
  hud.textContent = `spike failed: ${e instanceof Error ? e.message : String(e)}`;
  console.error("[SPIKE] failed", e);
});
