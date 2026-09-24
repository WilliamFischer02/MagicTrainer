import { Application, Container, Graphics, Sprite, Texture } from "pixi.js";
import { bezier, easeOut, mulberry32, newLeg, type Mover, type Pt } from "./fps";

/**
 * PixiJS 8 candidate (D-006): card sprites on a WebGL canvas, arrows as Graphics rebuilt
 * every frame (the expensive, honest path — a real board redraws live arrows).
 */
export interface Scene {
  update(t: number, dt: number): void;
  destroy(): void;
  label: string;
}

export interface SceneOpts {
  sprites: number;
  arrows: number;
  dpr: number;
  width: number;
  height: number;
}

const CARD_W = 54;
const CARD_H = 75; // 63:88 ≈ 54:75.4

function makeCardTexture(app: Application, hue: number, dpr: number): Texture {
  const canvas = document.createElement("canvas");
  canvas.width = CARD_W * dpr;
  canvas.height = CARD_H * dpr;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("2d context unavailable");
  ctx.scale(dpr, dpr);
  // frame
  ctx.fillStyle = "#1a2028";
  roundRect(ctx, 0, 0, CARD_W, CARD_H, 4);
  ctx.fill();
  // "art" gradient
  const g = ctx.createLinearGradient(0, 0, CARD_W, CARD_H);
  g.addColorStop(0, `hsl(${hue} 60% 45%)`);
  g.addColorStop(1, `hsl(${(hue + 40) % 360} 70% 20%)`);
  ctx.fillStyle = g;
  roundRect(ctx, 3, 3, CARD_W - 6, CARD_H - 22, 3);
  ctx.fill();
  // name bar
  ctx.fillStyle = "#e9dfc7";
  ctx.font = `${7}px "Segoe UI", system-ui, sans-serif`;
  ctx.fillText("Card name", 5, CARD_H - 9);
  const tex = Texture.from(canvas);
  tex.source.resolution = dpr;
  void app;
  return tex;
}

function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number): void {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

export async function createPixiScene(container: HTMLElement, opts: SceneOpts): Promise<Scene> {
  const app = new Application();
  await app.init({
    width: opts.width,
    height: opts.height,
    resolution: opts.dpr,
    autoDensity: true,
    antialias: true,
    background: 0x101418,
    preference: "webgl",
  });
  container.appendChild(app.canvas);
  app.ticker.stop(); // we drive rendering from the measurement loop

  const rand = mulberry32(42);
  const textures = Array.from({ length: 12 }, (_, i) => makeCardTexture(app, (i * 31) % 360, opts.dpr));
  const cards = new Container();
  const arrowsLayer = new Container();
  app.stage.addChild(arrowsLayer, cards);

  const movers: Mover[] = [];
  const sprites: Sprite[] = [];
  for (let i = 0; i < opts.sprites; i++) {
    const s = new Sprite(textures[i % textures.length]);
    s.anchor.set(0.5);
    s.width = CARD_W;
    s.height = CARD_H;
    const start: Pt = { x: 60 + rand() * (opts.width - 120), y: 60 + rand() * (opts.height - 140) };
    s.position.set(start.x, start.y);
    cards.addChild(s);
    sprites.push(s);
    movers.push(newLeg(rand, start, opts.width, opts.height, -rand() * 2));
  }
  const arrows: Graphics[] = [];
  for (let i = 0; i < opts.arrows; i++) {
    const g = new Graphics();
    arrowsLayer.addChild(g);
    arrows.push(g);
  }

  return {
    label: `pixi@${app.renderer.name} dpr${opts.dpr}`,
    update(t) {
      for (let i = 0; i < movers.length; i++) {
        let m = movers[i];
        let k = (t - m.startT) / m.duration;
        if (k >= 1) {
          m = movers[i] = newLeg(rand, m.to, opts.width, opts.height, t);
          k = 0;
        }
        const p = bezier(m.from, m.ctrl1, m.ctrl2, m.to, easeOut(Math.max(0, k)));
        sprites[i].position.set(p.x, p.y);
        sprites[i].rotation = (k - 0.5) * 0.15;
        if (i < arrows.length) {
          const g = arrows[i];
          g.clear();
          const seg = 24;
          const kk = easeOut(Math.max(0, k));
          g.moveTo(m.from.x, m.from.y);
          for (let s = 1; s <= seg; s++) {
            const q = bezier(m.from, m.ctrl1, m.ctrl2, m.to, (s / seg) * kk);
            g.lineTo(q.x, q.y);
          }
          g.stroke({ width: 3, color: 0xc9a227, alpha: 0.9, cap: "round", join: "round" });
          // arrowhead at the tip
          const tip = bezier(m.from, m.ctrl1, m.ctrl2, m.to, kk);
          const back = bezier(m.from, m.ctrl1, m.ctrl2, m.to, Math.max(0, kk - 0.02));
          const ang = Math.atan2(tip.y - back.y, tip.x - back.x);
          g.moveTo(tip.x, tip.y)
            .lineTo(tip.x - 12 * Math.cos(ang - 0.5), tip.y - 12 * Math.sin(ang - 0.5))
            .lineTo(tip.x - 12 * Math.cos(ang + 0.5), tip.y - 12 * Math.sin(ang + 0.5))
            .closePath()
            .fill({ color: 0xc9a227 });
        }
      }
      app.render();
    },
    destroy() {
      app.destroy(true, { children: true, texture: true });
    },
  };
}
