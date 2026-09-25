import { useMemo } from "react";
import { analyzeDeck, type ColorBalance, type Curve, type RoleCoverage } from "../../core/math/deckStats";
import type { Color, Deck } from "../../core/types";
import { Callout, Card, Spinner, formatCount } from "../components";
import { AlertIcon } from "../icons";
import { useCards } from "../queries";
import d from "./decks.module.css";
import s from "./screens.module.css";

/**
 * Deck Builder analysis: curve, color pips vs sources, type mix, role coverage vs the
 * Commander skeleton, legality. Numbers come from `core/math/deckStats`; this file only draws.
 * Charts follow the dataviz rules: one series per chart, thin marks, recessive grid, labels in
 * ink tokens, identity by label (mana letters) never by hue alone.
 */

const COLOR_NAME: Record<Color, string> = { W: "White", U: "Blue", B: "Black", R: "Red", G: "Green" };

export function DeckAnalysis({ deck }: { deck: Deck }) {
  const ids = useMemo(() => [...deck.commanders, ...deck.main].map((e) => e.oracleId).filter((x): x is string => !!x), [deck]);
  const cards = useCards(ids);
  const analysis = useMemo(() => (cards.data ? analyzeDeck(deck, cards.data) : null), [cards.data, deck]);

  if (ids.length === 0) {
    return (
      <Callout tone="warn" icon={<AlertIcon />}>
        None of this deck's cards are matched to the card database, so there is nothing to analyze. Re-import the list to run the name fixer.
      </Callout>
    );
  }
  if (cards.isPending || !analysis) {
    return (
      <div className={s.state} role="status" style={{ marginTop: 0 }}>
        <Spinner /> Analyzing deck…
      </div>
    );
  }
  if (cards.error) {
    return (
      <Callout tone="danger" icon={<AlertIcon />}>
        Could not load card data: {cards.error instanceof Error ? cards.error.message : String(cards.error)}
      </Callout>
    );
  }

  const { curve, colors, deckColors, types, roles, legality, missing } = analysis;
  const usedColors = colors.filter((c) => deckColors.includes(c.color) || c.pips > 0);

  return (
    <div className={d.analysis}>
      {legality.length > 0 && deck.format && (
        <Callout tone="danger" icon={<AlertIcon />}>
          Not legal in {deck.format}:{" "}
          {legality.map((l) => `${l.quantity > 1 ? `${l.quantity}× ` : ""}${l.name} (${l.status === "not_legal" ? "not legal" : l.status})`).join(", ")}.
        </Callout>
      )}
      {missing.length > 0 && (
        <Callout tone="warn" icon={<AlertIcon />}>
          {missing.length} line{missing.length === 1 ? " is" : "s are"} not matched to a card and {missing.length === 1 ? "is" : "are"} excluded from these numbers: {missing.map((m) => m.name).join(", ")}.
        </Callout>
      )}

      <div className={d.analysisGrid}>
        <Card title="Mana curve">
          <CurveChart curve={curve} />
          <div className={d.counts} style={{ marginTop: "var(--s-3)" }}>
            <Stat value={curve.averageMv.toFixed(2)} label="avg. mana value" />
            <Stat value={String(curve.medianMv)} label="median" />
            <Stat value={formatCount(curve.nonlandCount)} label="nonland" />
            <Stat value={formatCount(curve.landCount)} label="lands" />
          </div>
        </Card>

        <Card title="Color pips vs. sources">
          {usedColors.length === 0 ? <p className={d.muted}>Colorless deck — no colored pips.</p> : <ColorRows rows={usedColors} />}
          <p className={d.muted} style={{ marginTop: "var(--s-3)" }}>
            Pips: colored symbols in nonland mana costs (hybrid counts for both). Sources: lands that produce the color; “+n” are rocks, dorks, and other nonland producers.
          </p>
        </Card>

        <Card title={deck.format === "commander" ? "Role coverage vs. Commander skeleton" : "Role coverage"}>
          <RoleRows roles={roles} />
          <p className={d.muted} style={{ marginTop: "var(--s-3)" }}>
            Counted from Scryfall Tagger oracle tags (ramp, draw, removal, sweeper, tutor, recursion). Baseline: 36–38 lands, 8–12 ramp, 8–12 draw, 8–12 interaction, 2–4 sweepers.
          </p>
        </Card>

        <Card title="Card types">
          <ul className={d.typeList}>
            {types.map((t) => (
              <li key={t.type} className={d.typeRow}>
                <span>{typeLabel(t.type, t.count)}</span>
                <span className={d.typeBar} aria-hidden="true">
                  <span className={d.typeFill} style={{ width: `${(t.count / Math.max(1, analysis.totalCards)) * 100}%` }} />
                </span>
                <span className={d.typeCount}>{formatCount(t.count)}</span>
              </li>
            ))}
          </ul>
        </Card>
      </div>
    </div>
  );
}

function typeLabel(type: string, count: number): string {
  if (type === "Other" || count === 1) return type;
  return type === "Sorcery" ? "Sorceries" : `${type}s`;
}

function Stat({ value, label }: { value: string; label: string }) {
  return (
    <div className={d.count}>
      <span className={d.countVal}>{value}</span>
      <span className={d.countKey}>{label}</span>
    </div>
  );
}

/** Single-series bar chart: nonland cards per mana value. Thin marks, rounded tops, baseline anchored, recessive axis. */
function CurveChart({ curve }: { curve: Curve }) {
  const W = 420;
  const H = 150;
  const padL = 8;
  const padB = 22;
  const padT = 18;
  const n = curve.buckets.length;
  const gap = 6;
  const barW = (W - padL * 2 - gap * (n - 1)) / n;
  const max = Math.max(1, curve.maxBucket);
  const plotH = H - padB - padT;
  const gridSteps = max <= 5 ? max : 4;
  return (
    <figure className={d.chart}>
      <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label={`Mana curve: ${curve.buckets.map((b) => `${b.count} at ${b.label}`).join(", ")}`} className={d.chartSvg}>
        {Array.from({ length: gridSteps + 1 }, (_, i) => {
          const y = padT + plotH - (plotH * i) / gridSteps;
          return <line key={i} x1={padL} x2={W - padL} y1={y} y2={y} className={i === 0 ? d.axisLine : d.gridLine} />;
        })}
        {curve.buckets.map((b, i) => {
          const h = (b.count / max) * plotH;
          const x = padL + i * (barW + gap);
          const y = padT + plotH - h;
          const r = Math.min(4, h / 2);
          return (
            <g key={b.mv}>
              <title>{`Mana value ${b.label}: ${b.count} card${b.count === 1 ? "" : "s"}${b.creatures ? ` (${b.creatures} creature${b.creatures === 1 ? "" : "s"})` : ""}`}</title>
              {h > 0 && <path className={d.bar} d={`M${x},${padT + plotH} v${-(h - r)} a${r},${r} 0 0 1 ${r},${-r} h${barW - 2 * r} a${r},${r} 0 0 1 ${r},${r} v${h - r} z`} />}
              {b.count > 0 && (
                <text x={x + barW / 2} y={y - 5} textAnchor="middle" className={d.barLabel}>
                  {b.count}
                </text>
              )}
              <text x={x + barW / 2} y={H - 6} textAnchor="middle" className={d.axisLabel}>
                {b.label}
              </text>
            </g>
          );
        })}
      </svg>
      <figcaption className="sr-only">
        Nonland cards by mana value:{" "}
        {curve.buckets
          .filter((b) => b.count)
          .map((b) => `${b.label}: ${b.count}`)
          .join(", ")}
      </figcaption>
    </figure>
  );
}

function ColorRows({ rows }: { rows: ColorBalance[] }) {
  const maxPips = Math.max(1, ...rows.map((r) => r.pips));
  const maxSrc = Math.max(1, ...rows.map((r) => r.landSources + r.otherSources));
  return (
    <table className={d.colorTable}>
      <thead>
        <tr>
          <th scope="col">Color</th>
          <th scope="col">Pips</th>
          <th scope="col">Sources</th>
        </tr>
      </thead>
      <tbody>
        {rows.map((r) => {
          const gap = r.pipShare - r.sourceShare;
          const flag = r.pips > 0 && r.landSources === 0 ? "no land sources" : Math.abs(gap) >= 0.15 && r.pips > 0 ? (gap > 0 ? "under-sourced" : "over-sourced") : null;
          return (
            <tr key={r.color}>
              <th scope="row">
                <span className={`${d.manaBadge} ${d[`mana${r.color}`]}`} aria-hidden="true">
                  {r.color}
                </span>
                <span>{COLOR_NAME[r.color]}</span>
              </th>
              <td>
                <span className={d.miniBar} aria-hidden="true">
                  <span className={d.miniFill} style={{ width: `${(r.pips / maxPips) * 100}%` }} />
                </span>
                <span className={d.miniVal}>
                  {r.pips} <span className={d.muted}>({Math.round(r.pipShare * 100)}%)</span>
                </span>
              </td>
              <td>
                <span className={d.miniBar} aria-hidden="true">
                  <span className={d.miniFill} style={{ width: `${(r.landSources / maxSrc) * 100}%` }} />
                  {r.otherSources > 0 && <span className={`${d.miniFill} ${d.miniFillSoft}`} style={{ width: `${(r.otherSources / maxSrc) * 100}%` }} />}
                </span>
                <span className={d.miniVal}>
                  {r.landSources}
                  {r.otherSources > 0 ? <span className={d.muted}> +{r.otherSources}</span> : null} <span className={d.muted}>({Math.round(r.sourceShare * 100)}%)</span>
                </span>
                {flag && <span className={`${d.chip} ${d.chipWarn}`}>{flag}</span>}
              </td>
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}

function RoleRows({ roles }: { roles: RoleCoverage[] }) {
  const max = Math.max(1, ...roles.map((r) => Math.max(r.count, r.target?.max ?? 0)));
  return (
    <ul className={d.roleList}>
      {roles.map((r) => (
        <li key={r.id} className={d.roleRow} title={r.cards.length ? r.cards.join(", ") : undefined}>
          <span className={d.roleLabel}>{r.label}</span>
          <span className={d.miniBar} aria-hidden="true">
            {r.target && <span className={d.targetBand} style={{ left: `${(r.target.min / max) * 100}%`, width: `${((r.target.max - r.target.min) / max) * 100}%` }} />}
            <span className={`${d.miniFill} ${r.status === "low" ? d.miniFillWarn : ""}`} style={{ width: `${(r.count / max) * 100}%` }} />
          </span>
          <span className={d.miniVal}>
            {r.count}
            {r.target && <span className={d.muted}> / {r.target.min}–{r.target.max}</span>}
          </span>
          <span className={`${d.chip} ${r.status === "low" ? d.chipWarn : r.status === "ok" ? d.chipOk : ""}`}>{r.status === "info" ? "count" : r.status === "ok" ? "on target" : r.status}</span>
        </li>
      ))}
    </ul>
  );
}
