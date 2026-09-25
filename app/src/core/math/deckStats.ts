import type { CardOracle, Color, Deck, DeckEntry, Format } from "../types";

/**
 * Deck statistics for the Deck Builder: mana curve, color pips vs sources, type mix,
 * role coverage vs the Commander skeleton, and per-card legality. Framework-free, pure.
 *
 * Baselines: `knowledge/mtg-strategy/archetype-taxonomy.md` §Commander deck skeleton
 * (~36–38 lands, 10 ramp, 10 draw, 8–10 removal/interaction, 2–3 sweepers) and
 * `deckbuilding-fundamentals.md` (8–12 ramp; low curves can run 33–34 lands).
 */

export const COLORS: readonly Color[] = ["W", "U", "B", "R", "G"];

export interface CountedCard {
  card: CardOracle;
  /** Copies in the deck (commanders count as 1 each). */
  quantity: number;
  /** Where the entry came from. */
  section: "commanders" | "main";
}

/** Join deck entries to cards; entries without a card are returned as `missing`. */
export function joinDeck(deck: Pick<Deck, "commanders" | "main">, cards: ReadonlyMap<string, CardOracle>): { counted: CountedCard[]; missing: DeckEntry[] } {
  const counted: CountedCard[] = [];
  const missing: DeckEntry[] = [];
  const add = (entries: DeckEntry[], section: CountedCard["section"]) => {
    for (const e of entries) {
      const card = e.oracleId ? cards.get(e.oracleId) : undefined;
      if (card) counted.push({ card, quantity: e.quantity, section });
      else missing.push(e);
    }
  };
  add(deck.commanders, "commanders");
  add(deck.main, "main");
  return { counted, missing };
}

export function isLand(card: CardOracle): boolean {
  // Front-face type line for MDFCs like "Land // Instant" is still land-first; treat any face with Land as a land source,
  // but for the curve only count cards whose FRONT face is a land as lands.
  const front = card.typeLine.split(" // ")[0] ?? card.typeLine;
  return /\bLand\b/.test(front);
}

// ---- curve ------------------------------------------------------------------------------

export interface CurveBucket {
  /** Mana value; the last bucket is `7+`. */
  mv: number;
  label: string;
  count: number;
  creatures: number;
}

export interface Curve {
  buckets: CurveBucket[];
  nonlandCount: number;
  landCount: number;
  averageMv: number;
  medianMv: number;
  maxBucket: number;
}

export function manaCurve(cards: readonly CountedCard[]): Curve {
  const buckets: CurveBucket[] = Array.from({ length: 8 }, (_, i) => ({ mv: i, label: i === 7 ? "7+" : String(i), count: 0, creatures: 0 }));
  let nonland = 0;
  let land = 0;
  let total = 0;
  const mvs: number[] = [];
  for (const { card, quantity } of cards) {
    if (isLand(card)) {
      land += quantity;
      continue;
    }
    nonland += quantity;
    const mv = Math.max(0, Math.floor(card.cmc));
    const b = buckets[Math.min(7, mv)]!;
    b.count += quantity;
    if (/\bCreature\b/.test(card.typeLine)) b.creatures += quantity;
    total += mv * quantity;
    for (let i = 0; i < quantity; i++) mvs.push(mv);
  }
  mvs.sort((a, b) => a - b);
  const median = mvs.length ? (mvs.length % 2 ? mvs[(mvs.length - 1) / 2]! : (mvs[mvs.length / 2 - 1]! + mvs[mvs.length / 2]!) / 2) : 0;
  return {
    buckets,
    nonlandCount: nonland,
    landCount: land,
    averageMv: nonland ? Math.round((total / nonland) * 100) / 100 : 0,
    medianMv: median,
    maxBucket: Math.max(0, ...buckets.map((b) => b.count)),
  };
}

// ---- colors: pips vs sources -------------------------------------------------------------

export interface ColorBalance {
  color: Color;
  /** Colored pips across nonland mana costs (hybrid counts for each color, Phyrexian counts). */
  pips: number;
  /** Share of all colored pips, 0..1. */
  pipShare: number;
  /** Lands that can produce this color. */
  landSources: number;
  /** Nonland permanents that can produce it (rocks, dorks, treasure makers per Scryfall `produced_mana`). */
  otherSources: number;
  /** Share of all land color sources, 0..1. */
  sourceShare: number;
}

/** Count colored pips in a mana cost string like "{1}{W}{W}{W/U}{G/P}". */
export function pipsOf(manaCost: string | undefined): Record<Color, number> {
  const out: Record<Color, number> = { W: 0, U: 0, B: 0, R: 0, G: 0 };
  if (!manaCost) return out;
  for (const sym of manaCost.match(/\{[^}]+\}/g) ?? []) {
    const inner = sym.slice(1, -1).toUpperCase();
    for (const part of inner.split("/")) {
      if (part in out) out[part as Color] += 1;
    }
  }
  return out;
}

export function colorBalance(cards: readonly CountedCard[]): ColorBalance[] {
  const pips: Record<Color, number> = { W: 0, U: 0, B: 0, R: 0, G: 0 };
  const lands: Record<Color, number> = { W: 0, U: 0, B: 0, R: 0, G: 0 };
  const other: Record<Color, number> = { W: 0, U: 0, B: 0, R: 0, G: 0 };
  for (const { card, quantity } of cards) {
    const land = isLand(card);
    if (!land) {
      const p = pipsOf(card.manaCost);
      for (const c of COLORS) pips[c] += p[c] * quantity;
    }
    for (const m of card.producedMana ?? []) {
      if (COLORS.includes(m as Color)) (land ? lands : other)[m as Color] += quantity;
    }
  }
  const pipTotal = COLORS.reduce((n, c) => n + pips[c], 0);
  const landTotal = COLORS.reduce((n, c) => n + lands[c], 0);
  return COLORS.map((color) => ({
    color,
    pips: pips[color],
    pipShare: pipTotal ? pips[color] / pipTotal : 0,
    landSources: lands[color],
    otherSources: other[color],
    sourceShare: landTotal ? lands[color] / landTotal : 0,
  }));
}

/** Colors the deck actually uses (any pip or color identity of a commander). */
export function deckColors(cards: readonly CountedCard[]): Color[] {
  const set = new Set<Color>();
  for (const { card, section } of cards) {
    if (section === "commanders") for (const c of card.colorIdentity) set.add(c);
    const p = pipsOf(card.manaCost);
    for (const c of COLORS) if (p[c] > 0) set.add(c);
  }
  return COLORS.filter((c) => set.has(c));
}

// ---- type mix ---------------------------------------------------------------------------

export const TYPE_ORDER = ["Creature", "Instant", "Sorcery", "Artifact", "Enchantment", "Planeswalker", "Battle", "Land"] as const;
export type CardType = (typeof TYPE_ORDER)[number];

/** Primary type for a card (first of TYPE_ORDER found on the front face; lands win only when nothing else is present). */
export function primaryType(card: CardOracle): CardType | "Other" {
  const front = card.typeLine.split(" // ")[0] ?? card.typeLine;
  for (const t of TYPE_ORDER) {
    if (t === "Land") continue;
    if (new RegExp(`\\b${t}\\b`).test(front)) return t;
  }
  return /\bLand\b/.test(front) ? "Land" : "Other";
}

export function typeMix(cards: readonly CountedCard[]): { type: CardType | "Other"; count: number }[] {
  const counts = new Map<CardType | "Other", number>();
  for (const { card, quantity } of cards) {
    const t = primaryType(card);
    counts.set(t, (counts.get(t) ?? 0) + quantity);
  }
  return [...TYPE_ORDER, "Other" as const].map((type) => ({ type, count: counts.get(type) ?? 0 })).filter((x) => x.count > 0);
}

// ---- role coverage vs baseline --------------------------------------------------------

export interface RoleCoverage {
  id: string;
  label: string;
  count: number;
  /** Baseline range for the format (undefined when there is no accepted baseline). */
  target?: { min: number; max: number };
  cards: string[];
  /** Oracle-tag slugs that count toward the role (ancestor-expanded on the card side). */
  tags: string[];
  status: "low" | "ok" | "high" | "info";
}

interface RoleSpec {
  id: string;
  label: string;
  tags: string[];
  /** Skip lands (they never count as ramp/draw spells). */
  nonlandOnly?: boolean;
  commander?: { min: number; max: number };
}

/** Slugs verified against `knowledge/mtg-data-apis/oracle-tag-index.json` (2026-09-24); children match through ancestors. */
export const ROLE_SPECS: readonly RoleSpec[] = [
  { id: "ramp", label: "Ramp", tags: ["ramp", "mana-rock", "mana-dork", "mana-producer"], nonlandOnly: true, commander: { min: 8, max: 12 } },
  { id: "draw", label: "Card draw", tags: ["draw", "card-advantage", "repeatable-draw"], nonlandOnly: true, commander: { min: 8, max: 12 } },
  { id: "removal", label: "Removal / interaction", tags: ["removal", "counterspell"], nonlandOnly: true, commander: { min: 8, max: 12 } },
  { id: "sweeper", label: "Sweepers", tags: ["sweeper"], nonlandOnly: true, commander: { min: 2, max: 4 } },
  { id: "tutor", label: "Tutors", tags: ["tutor", "tutor-to"], nonlandOnly: true },
  { id: "recursion", label: "Recursion", tags: ["recursion", "reanimate"], nonlandOnly: true },
];

export function roleCoverage(cards: readonly CountedCard[], format: Format | undefined): RoleCoverage[] {
  const out: RoleCoverage[] = [];
  for (const spec of ROLE_SPECS) {
    let count = 0;
    const names: string[] = [];
    for (const { card, quantity } of cards) {
      if (spec.nonlandOnly && isLand(card)) continue;
      if (spec.tags.some((t) => card.oracleTags.includes(t))) {
        count += quantity;
        names.push(card.name);
      }
    }
    const target = format === "commander" ? spec.commander : undefined;
    const status: RoleCoverage["status"] = !target ? "info" : count < target.min ? "low" : count > target.max ? "high" : "ok";
    out.push({ id: spec.id, label: spec.label, count, target, cards: names, tags: spec.tags, status });
  }
  // Lands as a pseudo-role for Commander (36–38; 33–34 with avg MV ≤ 2.5).
  const curve = manaCurve(cards);
  if (format === "commander") {
    const low = curve.averageMv <= 2.5;
    const target = low ? { min: 33, max: 38 } : { min: 36, max: 38 };
    out.unshift({
      id: "lands",
      label: "Lands",
      count: curve.landCount,
      target,
      cards: [],
      tags: [],
      status: curve.landCount < target.min ? "low" : curve.landCount > target.max ? "high" : "ok",
    });
  } else {
    out.unshift({ id: "lands", label: "Lands", count: curve.landCount, cards: [], tags: [], status: "info" });
  }
  return out;
}

// ---- legality --------------------------------------------------------------------------

export interface LegalityIssue {
  name: string;
  quantity: number;
  status: "not_legal" | "banned" | "restricted" | "unknown";
}

/** Cards not legal in `format` per Scryfall legalities. Cards with no entry for the format are `unknown`. */
export function legalityIssues(cards: readonly CountedCard[], format: Format | undefined): LegalityIssue[] {
  if (!format || format === "casual") return [];
  const key = format;
  const out: LegalityIssue[] = [];
  for (const { card, quantity } of cards) {
    const v = card.legalities[key];
    if (v === "legal") continue;
    if (v === "restricted" && quantity <= 1) continue;
    out.push({ name: card.name, quantity, status: v ?? "unknown" });
  }
  return out.sort((a, b) => a.name.localeCompare(b.name));
}

/** Everything the Deck Builder analysis panel shows, in one call. */
export function analyzeDeck(deck: Pick<Deck, "commanders" | "main" | "format">, cards: ReadonlyMap<string, CardOracle>) {
  const { counted, missing } = joinDeck(deck, cards);
  return {
    counted,
    missing,
    curve: manaCurve(counted),
    colors: colorBalance(counted),
    deckColors: deckColors(counted),
    types: typeMix(counted),
    roles: roleCoverage(counted, deck.format),
    legality: legalityIssues(counted, deck.format),
    totalCards: counted.reduce((n, c) => n + c.quantity, 0) + missing.reduce((n, e) => n + e.quantity, 0),
  };
}
export type DeckAnalysis = ReturnType<typeof analyzeDeck>;
