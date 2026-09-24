import { animate } from "motion";
import { createRoot, type Root } from "react-dom/client";
import { bezier, easeOut, mulberry32, newLeg, pathD, type Mover, type Pt } from "./fps";
import type { Scene, SceneOpts } from "./pixiScene";

/**
 * SVG + Motion candidate (D-006): cards are absolutely-positioned DOM elements moved with
 * Motion's `animate()` (transform, off the main thread where WAAPI allows); arrows are SVG
 * `<path>` elements whose `d` is rewritten every frame from JS, like a real live arrow.
 * DPR 2 is emulated with `transform: scale(2)` on a half-size stage (same raster pixel count).
 */

const CARD_W = 54;
const CARD_H = 75;

function CardBoard({ count, w, h }: { count: number; w: number; h: number }) {
  return (
    <div style={{ position: "absolute", inset: 0, width: w, height: h }}>
      {Array.from({ length: count }, (_, i) => (
        <div
          key={i}
          data-card={i}
          style={{
            position: "absolute",
            left: -CARD_W / 2,
            top: -CARD_H / 2,
            width: CARD_W,
            height: CARD_H,
            borderRadius: 4,
            background: "#1a2028",
            boxShadow: "0 1px 3px rgba(0,0,0,.6)",
            willChange: "transform",
          }}
        >
          <div
            style={{
              position: "absolute",
              left: 3,
              top: 3,
              right: 3,
              height: CARD_H - 22,
              borderRadius: 3,
              background: `linear-gradient(135deg, hsl(${(i * 31) % 360} 60% 45%), hsl(${((i * 31) + 40) % 360} 70% 20%))`,
            }}
          />
          <div style={{ position: "absolute", left: 5, bottom: 4, fontSize: 7, color: "#e9dfc7" }}>Card name</div>
        </div>
      ))}
    </div>
  );
}

export function createSvgScene(container: HTMLElement, opts: SceneOpts): Scene {
  const scale = opts.dpr;
  const w = opts.width / scale;
  const h = opts.height / scale;
  const host = document.createElement("div");
  host.style.cssText = `position:absolute;left:0;top:0;width:${w}px;height:${h}px;transform:scale(${scale});transform-origin:0 0;`;
  container.appendChild(host);

  const root: Root = createRoot(host);
  root.render(<CardBoard count={opts.sprites} w={w} h={h} />);

  const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
  svg.setAttribute("width", String(w));
  svg.setAttribute("height", String(h));
  svg.style.cssText = "position:absolute;left:0;top:0;pointer-events:none;";
  host.appendChild(svg);
  const paths: SVGPathElement[] = [];
  const heads: SVGPolygonElement[] = [];
  for (let i = 0; i < opts.arrows; i++) {
    const p = document.createElementNS("http://www.w3.org/2000/svg", "path");
    p.setAttribute("fill", "none");
    p.setAttribute("stroke", "#c9a227");
    p.setAttribute("stroke-width", "3");
    p.setAttribute("stroke-linecap", "round");
    p.setAttribute("opacity", "0.9");
    svg.appendChild(p);
    paths.push(p);
    const head = document.createElementNS("http://www.w3.org/2000/svg", "polygon");
    head.setAttribute("fill", "#c9a227");
    svg.appendChild(head);
    heads.push(head);
  }

  const rand = mulberry32(42);
  const movers: Mover[] = [];
  const starts: Pt[] = [];
  for (let i = 0; i < opts.sprites; i++) {
    const start: Pt = { x: 60 + rand() * (w - 120), y: 60 + rand() * (h - 140) };
    starts.push(start);
    movers.push(newLeg(rand, start, w, h, -rand() * 2));
  }

  let cardEls: HTMLElement[] = [];
  let ready = false;
  // React commits synchronously enough for our purposes on next frame; look up once.
  const bind = () => {
    cardEls = Array.from(host.querySelectorAll<HTMLElement>("[data-card]"));
    if (cardEls.length !== opts.sprites) return false;
    cardEls.forEach((el, i) => {
      el.style.transform = `translate(${starts[i].x}px, ${starts[i].y}px)`;
    });
    return true;
  };

  // Motion drives the card translation per leg; we only re-issue an animation when a leg ends.
  const legEnd: number[] = movers.map((m) => m.startT + m.duration);
  const startLeg = (i: number, m: Mover, now: number) => {
    const el = cardEls[i];
    const remaining = Math.max(0.05, m.duration - (now - m.startT));
    // Motion interpolates x/y linearly between keyframes; sample the bezier at 8 points so the arc is kept.
    const xs: number[] = [];
    const ys: number[] = [];
    for (let s = 0; s <= 8; s++) {
      const p = bezier(m.from, m.ctrl1, m.ctrl2, m.to, s / 8);
      xs.push(p.x);
      ys.push(p.y);
    }
    animate(el, { x: xs, y: ys, rotate: [-4, 4] }, { duration: remaining, ease: "easeOut" });
  };

  return {
    label: `svg+motion dpr${opts.dpr}`,
    update(t) {
      if (!ready) {
        ready = bind();
        if (!ready) return;
        movers.forEach((m, i) => startLeg(i, m, t));
      }
      for (let i = 0; i < movers.length; i++) {
        let m = movers[i];
        if (t >= legEnd[i]) {
          m = movers[i] = newLeg(rand, m.to, w, h, t);
          legEnd[i] = m.startT + m.duration;
          startLeg(i, m, t);
        }
        if (i < paths.length) {
          const k = easeOut(Math.max(0, Math.min(1, (t - m.startT) / m.duration)));
          paths[i].setAttribute("d", pathD(m, k));
          const tip = bezier(m.from, m.ctrl1, m.ctrl2, m.to, k);
          const back = bezier(m.from, m.ctrl1, m.ctrl2, m.to, Math.max(0, k - 0.02));
          const ang = Math.atan2(tip.y - back.y, tip.x - back.x);
          heads[i].setAttribute(
            "points",
            `${tip.x},${tip.y} ${tip.x - 12 * Math.cos(ang - 0.5)},${tip.y - 12 * Math.sin(ang - 0.5)} ${tip.x - 12 * Math.cos(ang + 0.5)},${tip.y - 12 * Math.sin(ang + 0.5)}`,
          );
        }
      }
    },
    destroy() {
      root.unmount();
      host.remove();
    },
  };
}
