import { animate } from "motion";
import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import type { BoardSnapshot, ZoneCard } from "../core/trainer/boardState";
import type { TimelineStep } from "../core/trainer/timeline";
import type { CardOracle, Zone } from "../core/types";
import { CardSprite } from "./CardSprite";
import b from "./board.module.css";

/**
 * The board (docs/VISUALIZATION_SPEC.md): opponent strip · battlefields · your zone row, with an
 * SVG overlay for arrows. Moves are FLIP-animated: after each snapshot change the scene measures
 * every `[data-key]` sprite, animates the touched ones from their previous rect, and draws an arrow
 * from the old centre (or the source zone) to the new one. `prefers-reduced-motion` collapses
 * durations to 0 and keeps the arrow as a static highlight (D-006, spec §Accessibility).
 */

export interface BoardSceneProps {
  snapshot: BoardSnapshot;
  step?: TimelineStep;
  cardOf: (name: string) => CardOracle | undefined;
  reducedMotion: boolean;
}

type Rect = { x: number; y: number; w: number; h: number };
type Arrow = { id: number; d: string; kind: string; label?: string; ghost: boolean };

const ZONE_LABEL: Record<Zone, string> = {
  library: "Library",
  hand: "Hand",
  stack: "Stack",
  battlefield: "Battlefield",
  graveyard: "Graveyard",
  exile: "Exile",
  command: "Command",
};
const ZONE_CR: Record<Zone, string> = { library: "CR 401", hand: "CR 402", stack: "CR 405", battlefield: "CR 403", graveyard: "CR 404", exile: "CR 406", command: "CR 408" };

function arrowKind(step: TimelineStep | undefined): string {
  if (!step) return "move";
  const a = step.action.toLowerCase();
  if (a.includes("attack")) return "attack";
  if (step.to === "graveyard" && (a.includes("sacrifice") || a.includes("destroy") || a.includes("dies") || a.includes("counter") || a.includes("discard"))) return "remove";
  if (step.from === "graveyard" && step.to === "battlefield") return "return";
  if (a.includes("reanimate") || a.includes("return")) return "return";
  if (step.to === "exile") return "exile";
  if (step.from === "library") return "draw";
  return "move";
}

function durationFor(step: TimelineStep | undefined, reduced: boolean): number {
  if (reduced) return 0;
  const a = step?.action.toLowerCase() ?? "";
  if (a.includes("reanimate")) return 0.6;
  if (a.includes("cast")) return 0.35;
  return 0.45;
}

export function BoardScene({ snapshot, step, cardOf, reducedMotion }: BoardSceneProps) {
  const root = useRef<HTMLDivElement>(null);
  const prevRects = useRef<Map<string, Rect>>(new Map());
  const prevZoneRects = useRef<Map<string, Rect>>(new Map());
  const [arrows, setArrows] = useState<Arrow[]>([]);
  const arrowId = useRef(0);

  const measure = () => {
    const host = root.current;
    const rects = new Map<string, Rect>();
    const zones = new Map<string, Rect>();
    if (!host) return { rects, zones };
    const base = host.getBoundingClientRect();
    host.querySelectorAll<HTMLElement>("[data-key]").forEach((el) => {
      const r = el.getBoundingClientRect();
      rects.set(el.dataset.key!, { x: r.left - base.left, y: r.top - base.top, w: r.width, h: r.height });
    });
    host.querySelectorAll<HTMLElement>("[data-zone]").forEach((el) => {
      const r = el.getBoundingClientRect();
      zones.set(el.dataset.zone!, { x: r.left - base.left, y: r.top - base.top, w: r.width, h: r.height });
    });
    return { rects, zones };
  };

  useLayoutEffect(() => {
    const { rects, zones } = measure();
    const before = prevRects.current;
    const beforeZones = prevZoneRects.current;
    const host = root.current;
    const dur = durationFor(step, reducedMotion);
    const newArrows: Arrow[] = [];
    if (host && step && snapshot.index >= 0) {
      const kind = arrowKind(step);
      const actor = step.actor;
      for (const key of snapshot.touched) {
        const now = rects.get(key);
        const was = before.get(key);
        const el = host.querySelector<HTMLElement>(`[data-key="${CSS.escape(key)}"]`);
        if (now && was && el && (Math.abs(now.x - was.x) > 1 || Math.abs(now.y - was.y) > 1)) {
          // FLIP: start at the old position, settle at the new one.
          const dx = was.x - now.x;
          const dy = was.y - now.y;
          if (dur > 0) animate(el, { transform: [`translate(${dx}px, ${dy}px)`, "translate(0px, 0px)"] }, { duration: dur, ease: [0.2, 0.8, 0.2, 1] });
          newArrows.push({ id: ++arrowId.current, d: curve(center(was), center(now)), kind, label: step.damage ? `${step.damage}` : undefined, ghost: false });
        } else if (now && !was) {
          // Came from an anonymous zone (library) or appeared: arrow from the source zone box.
          const from = beforeZones.get(`${actor}:${step.from}`) ?? zones.get(`${actor}:${step.from}`);
          if (dur > 0 && el) animate(el, { opacity: [0, 1], transform: ["scale(0.7)", "scale(1)"] }, { duration: dur });
          if (from) newArrows.push({ id: ++arrowId.current, d: curve(center(from), center(now)), kind, ghost: false });
        } else if (!now && was) {
          // Went into an anonymous zone (library) or left the board: arrow to the target zone box.
          const to = zones.get(`${actor}:${step.to}`);
          if (to) newArrows.push({ id: ++arrowId.current, d: curve(center(was), center(to)), kind, ghost: false });
        } else if (now && was && step.from === step.to) {
          // In-place effect (attack / trigger): attack draws an arrow to the other player's HUD.
          if (kind === "attack") {
            const target = zones.get(`${actor === "you" ? "opponent" : "you"}:life`);
            if (target) newArrows.push({ id: ++arrowId.current, d: curve(center(now), center(target)), kind, label: step.damage ? `${step.damage}` : undefined, ghost: false });
          }
        }
      }
    }
    prevRects.current = rects;
    prevZoneRects.current = zones;
    if (newArrows.length) {
      setArrows((old) => [...old.filter((a) => !a.ghost).map((a) => ({ ...a, ghost: true })).slice(-3), ...newArrows]);
    } else if (snapshot.index < 0) {
      setArrows([]);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [snapshot]);

  // Window / container resize: re-baseline the measured rects so the next FLIP does not mix coordinate systems.
  useEffect(() => {
    const host = root.current;
    if (!host || typeof ResizeObserver === "undefined") return;
    const ro = new ResizeObserver(() => {
      const { rects, zones } = measure();
      prevRects.current = rects;
      prevZoneRects.current = zones;
    });
    ro.observe(host);
    return () => ro.disconnect();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Draw arrows with a path-length sweep; static when motion is reduced.
  useEffect(() => {
    if (reducedMotion) return;
    const host = root.current;
    if (!host) return;
    host.querySelectorAll<SVGPathElement>("path[data-fresh='1']").forEach((p) => {
      const len = p.getTotalLength();
      p.style.strokeDasharray = `${len}`;
      animate(p, { strokeDashoffset: [len, 0] }, { duration: 0.4, ease: "easeOut" });
      p.dataset.fresh = "0";
    });
  }, [arrows, reducedMotion]);

  const you = snapshot.you;
  const opp = snapshot.opponent;
  const touched = useMemo(() => new Set(snapshot.touched), [snapshot.touched]);
  const pulse = snapshot.pulse;
  const highlight = (c: ZoneCard) => touched.has(c.key);
  const rows = (cards: ZoneCard[]) => classify(cards, cardOf);

  return (
    <div className={b.scene} ref={root}>
      {/* Opponent strip */}
      <div className={b.oppStrip}>
        <Pile label="Library" zoneKey="opponent:library" count={opp.library.length} cr={ZONE_CR.library} />
        <Pile label="Hand" zoneKey="opponent:hand" count={snapshot.ledger.cardsInHand.opponent} cr={ZONE_CR.hand} faceDown={snapshot.ledger.cardsInHand.opponent} />
        <div className={`${b.bf} ${b.bfOpp}`} data-zone="opponent:battlefield">
          <span className={b.zoneTag} title={`Battlefield — ${ZONE_CR.battlefield}`}>
            Opponent's battlefield
          </span>
          <BfRows rows={rows(opp.battlefield)} cardOf={cardOf} size="xs" highlight={highlight} pulse={pulse} />
          {opp.stack.length > 0 && <Stack who="opponent" cards={opp.stack} cardOf={cardOf} highlight={highlight} />}
        </div>
        <ZoneList label="Graveyard" zoneKey="opponent:graveyard" cards={opp.graveyard} cardOf={cardOf} cr={ZONE_CR.graveyard} highlight={highlight} />
        <ZoneList label="Exile" zoneKey="opponent:exile" cards={opp.exile} cardOf={cardOf} cr={ZONE_CR.exile} highlight={highlight} />
        <Hud who="opponent" name="Opponent" life={snapshot.ledger.life.opponent} hand={snapshot.ledger.cardsInHand.opponent} damage={snapshot.ledger.damageDealt.opponent} />
      </div>

      {/* Your battlefield */}
      <div className={b.battlefields}>
        <div className={b.bf} data-zone="you:battlefield">
          <span className={b.zoneTag} title={`Battlefield — ${ZONE_CR.battlefield}`}>
            Your battlefield
          </span>
          <BfRows rows={rows(you.battlefield)} cardOf={cardOf} size="sm" highlight={highlight} pulse={pulse} />
          {you.stack.length > 0 && <Stack who="you" cards={you.stack} cardOf={cardOf} highlight={highlight} />}
        </div>
        {/* Your zone row */}
        <div className={b.youBottom}>
          <ZoneList label="Command" zoneKey="you:command" cards={you.command} cardOf={cardOf} cr={ZONE_CR.command} highlight={highlight} size="sm" />
          <Pile label="Library" zoneKey="you:library" count={you.library.length} cr={ZONE_CR.library} />
          <div className={`${b.zone} ${b.hand}`} data-zone="you:hand">
            <div className={b.zoneHead}>
              <span title={`Hand — ${ZONE_CR.hand}`}>Hand</span>
              <span className={b.zoneCount} title={`${you.hand.length} named cards shown of ${snapshot.ledger.cardsInHand.you} in hand`}>
                {you.hand.length} / {snapshot.ledger.cardsInHand.you}
              </span>
            </div>
            <div className={b.fan}>
              {you.hand.map((c) => (
                <CardSprite key={c.key} card={c} oracle={cardOf(c.name)} size="sm" highlight={highlight(c)} />
              ))}
              {you.hand.length === 0 && <span className={b.pileEmpty + " " + b.pile}>—</span>}
            </div>
          </div>
          <ZoneList label="Graveyard" zoneKey="you:graveyard" cards={you.graveyard} cardOf={cardOf} cr={ZONE_CR.graveyard} highlight={highlight} />
          <ZoneList label="Exile" zoneKey="you:exile" cards={you.exile} cardOf={cardOf} cr={ZONE_CR.exile} highlight={highlight} />
          <Hud who="you" name="You" life={snapshot.ledger.life.you} hand={snapshot.ledger.cardsInHand.you} mana={snapshot.ledger.manaSpentThisTurn} damage={snapshot.ledger.damageDealt.you} />
        </div>
      </div>

      <svg className={b.overlay} aria-hidden="true">
        <defs>
          {["move", "attack", "remove", "return", "exile", "draw"].map((k) => (
            <marker key={k} id={`head-${k}`} viewBox="0 0 10 10" refX="8" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse">
              <path d="M0,0 L10,5 L0,10 z" className={`${b.arrowHead} ${headClass(k)}`} />
            </marker>
          ))}
        </defs>
        {arrows.map((a) => (
          <g key={a.id} className={a.ghost ? b.ghost : undefined}>
            <path d={a.d} className={`${b.arrow} ${arrowClass(a.kind)}`} markerEnd={`url(#head-${a.kind})`} data-fresh={a.ghost ? "0" : "1"} />
            {a.label && !a.ghost && (
              <text className={b.arrowLabel} {...labelPos(a.d)}>
                {a.label}
              </text>
            )}
          </g>
        ))}
      </svg>
    </div>
  );
}

function headClass(kind: string): string {
  return kind === "attack" ? b.headAttack : kind === "remove" ? b.headRemove : kind === "return" ? b.headReturn : kind === "exile" ? b.headExile : kind === "draw" ? b.headDraw : "";
}
function arrowClass(kind: string): string {
  return kind === "attack" ? b.arrowAttack : kind === "remove" ? b.arrowRemove : kind === "return" ? b.arrowReturn : kind === "exile" ? b.arrowExile : kind === "draw" ? b.arrowDraw : "";
}

function center(r: Rect): { x: number; y: number } {
  return { x: r.x + r.w / 2, y: r.y + r.h / 2 };
}

/** Quadratic curve bowing perpendicular to the segment so straight-line arrows still read as motion. */
function curve(a: { x: number; y: number }, c: { x: number; y: number }): string {
  const mx = (a.x + c.x) / 2;
  const my = (a.y + c.y) / 2;
  const dx = c.x - a.x;
  const dy = c.y - a.y;
  const len = Math.max(1, Math.hypot(dx, dy));
  const bow = Math.min(60, len * 0.18);
  const cx = mx - (dy / len) * bow;
  const cy = my + (dx / len) * bow;
  return `M${a.x.toFixed(1)},${a.y.toFixed(1)} Q${cx.toFixed(1)},${cy.toFixed(1)} ${c.x.toFixed(1)},${c.y.toFixed(1)}`;
}

function labelPos(d: string): { x: number; y: number } {
  const m = /Q([\d.]+),([\d.]+)/.exec(d);
  return m ? { x: Number(m[1]) + 6, y: Number(m[2]) - 6 } : { x: 0, y: 0 };
}

type RowKey = "lands" | "creatures" | "other";
function classify(cards: ZoneCard[], cardOf: (n: string) => CardOracle | undefined): Record<RowKey, ZoneCard[]> {
  const out: Record<RowKey, ZoneCard[]> = { lands: [], creatures: [], other: [] };
  for (const c of cards) {
    const o = cardOf(c.name);
    const type = o?.typeLine ?? c.name;
    if (/\bLand\b/i.test(type) || /\bland\b/i.test(c.name)) out.lands.push(c);
    else if (/\bCreature\b/i.test(type) || /creature|drop|team|finisher/i.test(c.name)) out.creatures.push(c);
    else out.other.push(c);
  }
  return out;
}

function BfRows({ rows, cardOf, size, highlight, pulse }: { rows: Record<RowKey, ZoneCard[]>; cardOf: (n: string) => CardOracle | undefined; size: "xs" | "sm"; highlight: (c: ZoneCard) => boolean; pulse?: BoardSnapshot["pulse"] }) {
  const order: [RowKey, string][] = [["other", "Other permanents"], ["creatures", "Creatures"], ["lands", "Lands"]];
  return (
    <>
      {order.map(([key, label]) => (
        <div key={key} className={b.bfRow}>
          <span className={b.bfRowLabel}>{label}</span>
          {rows[key].map((c) => (
            <CardSprite key={c.key} card={c} oracle={cardOf(c.name)} size={size} highlight={highlight(c)} pulseLabel={pulse?.key === c.key ? pulse.label : undefined} />
          ))}
        </div>
      ))}
    </>
  );
}

function Stack({ who, cards, cardOf, highlight }: { who: "you" | "opponent"; cards: ZoneCard[]; cardOf: (n: string) => CardOracle | undefined; highlight: (c: ZoneCard) => boolean }) {
  return (
    <div className={b.stack} data-zone={`${who}:stack`} title={`The stack — ${ZONE_CR.stack}`}>
      <span className={b.stackLabel}>Stack</span>
      {cards.map((c) => (
        <CardSprite key={c.key} card={c} oracle={cardOf(c.name)} size="sm" highlight={highlight(c)} />
      ))}
    </div>
  );
}

function Pile({ label, zoneKey, count, cr, faceDown }: { label: string; zoneKey: string; count: number; cr: string; faceDown?: number }) {
  return (
    <div className={b.zone} data-zone={zoneKey}>
      <div className={b.zoneHead}>
        <span title={`${label} — ${cr}`}>{label}</span>
        <span className={b.zoneCount}>{count}</span>
      </div>
      <div className={b.zoneBody}>
        <div className={`${b.pile} ${count === 0 ? b.pileEmpty : ""} ${faceDown !== undefined && count > 0 ? b.pileBack : ""}`} aria-label={`${count} cards in ${label.toLowerCase()}`}>
          {count === 0 ? "—" : count}
        </div>
      </div>
    </div>
  );
}

function ZoneList({ label, zoneKey, cards, cardOf, cr, highlight, size = "xs" }: { label: string; zoneKey: string; cards: ZoneCard[]; cardOf: (n: string) => CardOracle | undefined; cr: string; highlight: (c: ZoneCard) => boolean; size?: "xs" | "sm" }) {
  const shown = cards.slice(-2);
  return (
    <div className={b.zone} data-zone={zoneKey}>
      <div className={b.zoneHead}>
        <span title={`${label} — ${cr}`}>{label}</span>
        <span className={b.zoneCount}>{cards.length}</span>
      </div>
      <div className={`${b.zoneBody} ${b.zoneStack}`}>
        {shown.length === 0 && <div className={`${b.pile} ${b.pileEmpty}`}>—</div>}
        {shown.map((c) => (
          <CardSprite key={c.key} card={c} oracle={cardOf(c.name)} size={size} highlight={highlight(c)} />
        ))}
      </div>
    </div>
  );
}

function Hud({ who, name, life, hand, mana, damage }: { who: "you" | "opponent"; name: string; life: number; hand: number; mana?: number; damage: number }) {
  const prev = useRef(life);
  const [delta, setDelta] = useState<number | null>(null);
  useEffect(() => {
    const d = life - prev.current;
    prev.current = life;
    if (d !== 0) {
      setDelta(d);
      const t = setTimeout(() => setDelta(null), 1600);
      return () => clearTimeout(t);
    }
  }, [life]);
  return (
    <div className={b.hud} data-zone={`${who}:life`} aria-label={`${name}: ${life} life`}>
      <span className={b.hudName}>{name}</span>
      <div className={b.hudItem}>
        <span className={b.hudVal}>
          {life}
          {delta !== null && <span className={`${b.hudDelta} ${delta < 0 ? b.deltaDown : b.deltaUp}`}>{delta > 0 ? `+${delta}` : delta}</span>}
        </span>
        <span className={b.hudKey}>life</span>
      </div>
      <div className={b.hudItem}>
        <span className={b.hudVal}>{hand}</span>
        <span className={b.hudKey}>in hand</span>
      </div>
      <div className={b.hudItem}>
        <span className={b.hudVal}>{mana !== undefined ? mana : damage}</span>
        <span className={b.hudKey}>{mana !== undefined ? "mana this turn" : "dealt"}</span>
      </div>
    </div>
  );
}

export const ZONE_LABELS = ZONE_LABEL;
