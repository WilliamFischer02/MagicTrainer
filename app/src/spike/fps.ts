/**
 * Frame-time measurement for the board spike. Runs one requestAnimationFrame loop, hands
 * `(t, dt)` to the scene each frame, and after `seconds` returns fps + percentiles.
 */
export interface FpsReport {
  frames: number;
  seconds: number;
  fps: number;
  /** Frame-time percentiles in ms. */
  p50: number;
  p95: number;
  p99: number;
  max: number;
  /** Frames longer than 16.7 ms (missed a 60 Hz vsync). */
  longFrames: number;
  /** Time spent inside the scene's `update()` per frame, ms (scripting cost, excludes browser paint). */
  tickP50: number;
  tickP95: number;
}

export function measure(seconds: number, tick: (t: number, dt: number) => void): Promise<FpsReport> {
  return new Promise((resolve) => {
    const dts: number[] = [];
    const ticks: number[] = [];
    let start = 0;
    let last = 0;
    const loop = (now: number) => {
      if (!start) {
        start = now;
        last = now;
        tick(0, 0);
        requestAnimationFrame(loop);
        return;
      }
      const dt = now - last;
      last = now;
      dts.push(dt);
      const t0 = performance.now();
      tick((now - start) / 1000, dt / 1000);
      ticks.push(performance.now() - t0);
      if (now - start < seconds * 1000) {
        requestAnimationFrame(loop);
        return;
      }
      const sorted = [...dts].sort((a, b) => a - b);
      const sortedTicks = [...ticks].sort((a, b) => a - b);
      const pctOf = (arr: number[], p: number) => arr[Math.min(arr.length - 1, Math.floor((p / 100) * arr.length))] ?? 0;
      const pct = (p: number) => pctOf(sorted, p);
      const total = (now - start) / 1000;
      resolve({
        frames: dts.length,
        seconds: round(total),
        fps: round(dts.length / total),
        p50: round(pct(50)),
        p95: round(pct(95)),
        p99: round(pct(99)),
        max: round(sorted[sorted.length - 1] ?? 0),
        longFrames: dts.filter((d) => d > 17.5).length,
        tickP50: round(pctOf(sortedTicks, 50)),
        tickP95: round(pctOf(sortedTicks, 95)),
      });
    };
    requestAnimationFrame(loop);
  });
}

function round(n: number): number {
  return Math.round(n * 10) / 10;
}

/** Cubic bezier point. */
export function bezier(p0: Pt, p1: Pt, p2: Pt, p3: Pt, t: number): Pt {
  const u = 1 - t;
  const a = u * u * u;
  const b = 3 * u * u * t;
  const c = 3 * u * t * t;
  const d = t * t * t;
  return { x: a * p0.x + b * p1.x + c * p2.x + d * p3.x, y: a * p0.y + b * p1.y + c * p2.y + d * p3.y };
}

export interface Pt {
  x: number;
  y: number;
}

/** Deterministic PRNG so both renderers animate the same paths. */
export function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** A card that flies between random board points on a bezier, forever. */
export interface Mover {
  from: Pt;
  ctrl1: Pt;
  ctrl2: Pt;
  to: Pt;
  startT: number;
  duration: number;
}

export function newLeg(rand: () => number, from: Pt, w: number, h: number, now: number): Mover {
  const to = { x: 40 + rand() * (w - 120), y: 40 + rand() * (h - 140) };
  const lift = 80 + rand() * 160;
  return {
    from,
    to,
    ctrl1: { x: from.x + (to.x - from.x) * 0.25, y: Math.min(from.y, to.y) - lift },
    ctrl2: { x: from.x + (to.x - from.x) * 0.75, y: Math.min(from.y, to.y) - lift },
    startT: now,
    duration: 1.6 + rand() * 1.2,
  };
}

/** Ease-out cubic, the "cast" feel from VISUALIZATION_SPEC. */
export function easeOut(t: number): number {
  return 1 - Math.pow(1 - t, 3);
}

export function pathD(m: Mover, t: number): string {
  // Partial cubic bezier via de Casteljau split at t.
  const { from: p0, ctrl1: p1, ctrl2: p2, to: p3 } = m;
  const lerp = (a: Pt, b: Pt, s: number): Pt => ({ x: a.x + (b.x - a.x) * s, y: a.y + (b.y - a.y) * s });
  const p01 = lerp(p0, p1, t);
  const p12 = lerp(p1, p2, t);
  const p23 = lerp(p2, p3, t);
  const p012 = lerp(p01, p12, t);
  const p123 = lerp(p12, p23, t);
  const end = lerp(p012, p123, t);
  return `M${p0.x.toFixed(1)},${p0.y.toFixed(1)} C${p01.x.toFixed(1)},${p01.y.toFixed(1)} ${p012.x.toFixed(1)},${p012.y.toFixed(1)} ${end.x.toFixed(1)},${end.y.toFixed(1)}`;
}
