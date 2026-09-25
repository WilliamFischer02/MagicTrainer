import { z } from "zod";
import type { StrategyMatch } from "../types";

/**
 * Commander Spellbook variants → `StrategyMatch` (D-005: combos are confirmed against
 * Spellbook, never invented; D-008: every match names the variant id that produced it).
 *
 * Shapes mirror the Rust projection in `app/src-tauri/rust/import/spellbook.rs` and the
 * `find-my-combos` contract in `rust/spellbook_api.rs`, verified live 2026-09-24 against
 * `knowledge/mtg-data-apis/commander-spellbook/sample_find-my-combos_exquisite-blood.json`.
 * Framework-free: no React/Tauri/DOM here.
 */

export const SPELLBOOK_SITE = "https://commanderspellbook.com";

export const SpellbookCardSchema = z.object({
  id: z.number().nullable().optional(),
  name: z.string(),
  oracleId: z.string().nullable().optional(),
  typeLine: z.string().nullable().optional(),
});

export const SpellbookCardUseSchema = z.object({
  card: SpellbookCardSchema,
  quantity: z.number().default(1),
  zoneLocations: z.array(z.string()).default([]),
  mustBeCommander: z.boolean().default(false),
  battlefieldCardState: z.string().default(""),
  exileCardState: z.string().default(""),
  graveyardCardState: z.string().default(""),
  libraryCardState: z.string().default(""),
});

export const SpellbookTemplateUseSchema = z.object({
  template: z.object({ name: z.string().default(""), scryfallQuery: z.string().nullable().optional() }),
  quantity: z.number().default(1),
  zoneLocations: z.array(z.string()).default([]),
});

export const SpellbookProducesSchema = z.object({
  feature: z.object({ id: z.number().nullable().optional(), name: z.string().default(""), uncountable: z.boolean().default(false) }),
  quantity: z.number().nullable().optional(),
});

export const SpellbookVariantSchema = z.object({
  id: z.string(),
  status: z.string().default("OK"),
  identity: z.string().default(""),
  uses: z.array(SpellbookCardUseSchema).default([]),
  requires: z.array(SpellbookTemplateUseSchema).default([]),
  produces: z.array(SpellbookProducesSchema).default([]),
  legalities: z.record(z.string(), z.boolean()).default({}),
  popularity: z.number().nullable().optional(),
  bracketTag: z.string().nullable().optional(),
  manaNeeded: z.string().nullable().optional(),
  manaValueNeeded: z.number().nullable().optional(),
  description: z.string().nullable().optional(),
  easyPrerequisites: z.string().nullable().optional(),
  notablePrerequisites: z.string().nullable().optional(),
  notes: z.string().nullable().optional(),
  spoiler: z.boolean().default(false),
});
export type SpellbookVariant = z.infer<typeof SpellbookVariantSchema>;

export const FindMyCombosResultsSchema = z.object({
  identity: z.string().default(""),
  included: z.array(SpellbookVariantSchema).default([]),
  includedByChangingCommanders: z.array(SpellbookVariantSchema).default([]),
  almostIncluded: z.array(SpellbookVariantSchema).default([]),
  almostIncludedByAddingColors: z.array(SpellbookVariantSchema).default([]),
  almostIncludedByChangingCommanders: z.array(SpellbookVariantSchema).default([]),
  almostIncludedByAddingColorsAndChangingCommanders: z.array(SpellbookVariantSchema).default([]),
});
export type FindMyCombosResults = z.infer<typeof FindMyCombosResultsSchema>;

/** Spellbook's single-letter zone codes (`zoneLocations`) → readable labels. */
export const SPELLBOOK_ZONE_LABEL: Record<string, string> = {
  H: "hand",
  B: "battlefield",
  C: "command zone",
  G: "graveyard",
  L: "library",
  E: "exile",
};

export function spellbookComboUrl(variantId: string): string {
  return `${SPELLBOOK_SITE}/combo/${encodeURIComponent(variantId)}/`;
}

/** Card names a variant needs (templates like "a sacrifice outlet" are listed separately). */
export function variantCardNames(v: SpellbookVariant): string[] {
  return v.uses.map((u) => u.card.name);
}

export function variantTemplateNames(v: SpellbookVariant): string[] {
  return v.requires.map((r) => r.template.name).filter(Boolean);
}

/** What the combo yields, e.g. ["Infinite lifegain", "Infinite lifeloss"]. */
export function variantProduces(v: SpellbookVariant): string[] {
  return v.produces.map((p) => p.feature.name).filter(Boolean);
}

/** Short human label: "Exquisite Blood + Sanguine Bond". */
export function variantLabel(v: SpellbookVariant): string {
  const names = variantCardNames(v);
  const templates = variantTemplateNames(v);
  return [...names, ...templates.map((t) => `(${t})`)].join(" + ");
}

/**
 * Confidence for a confirmed Spellbook combo present in the deck. Spellbook already
 * verified the line, so the base is high; fewer pieces and no template requirements
 * make it more reliable to assemble in a real game.
 */
export function variantConfidence(v: SpellbookVariant): number {
  const pieces = v.uses.length + v.requires.length;
  const base = pieces <= 2 ? 0.95 : pieces === 3 ? 0.9 : 0.8;
  const templatePenalty = v.requires.length > 0 ? 0.05 : 0;
  return Math.round((base - templatePenalty) * 100) / 100;
}

/** Map a confirmed (`included`) variant to a StrategyMatch with a full rationale. */
export function variantToStrategyMatch(v: SpellbookVariant): StrategyMatch {
  const names = variantCardNames(v);
  const templates = variantTemplateNames(v);
  const produces = variantProduces(v);
  const roles: Record<string, string[]> = { pieces: names };
  if (templates.length) roles.templates = templates;
  const rationaleParts = [
    `Commander Spellbook variant ${v.id}`,
    `uses ${names.join(", ")}${templates.length ? ` + ${templates.join(", ")}` : ""}`,
    produces.length ? `produces ${produces.join(", ")}` : "",
    v.bracketTag ? `bracket tag ${v.bracketTag}` : "",
  ].filter(Boolean);
  return {
    patternId: `spellbook:${v.id}`,
    label: variantLabel(v),
    confidence: variantConfidence(v),
    roles,
    rationale: rationaleParts.join("; "),
    externalRef: { source: "commander-spellbook", id: v.id, url: spellbookComboUrl(v.id) },
  };
}

export interface NearMissCombo {
  variant: SpellbookVariant;
  match: StrategyMatch;
  /** Card names the deck is missing. */
  missing: string[];
  /** Why Spellbook filed it where it did. */
  reason: "almost" | "adding-colors" | "changing-commanders" | "adding-colors-and-changing-commanders";
}

/** Case-insensitive, whitespace-normalized name key. Split/DFC names compare on the front face too. */
function nameKey(name: string): string {
  return name.trim().toLowerCase().replace(/\s+/g, " ");
}

function deckNameSet(deckNames: readonly string[]): Set<string> {
  const set = new Set<string>();
  for (const n of deckNames) {
    const k = nameKey(n);
    set.add(k);
    const front = k.split(" // ")[0];
    if (front) set.add(front);
  }
  return set;
}

/** Cards a variant needs that the deck lacks. */
export function missingCards(v: SpellbookVariant, deckNames: readonly string[] | Set<string>): string[] {
  const have = deckNames instanceof Set ? deckNames : deckNameSet(deckNames);
  return variantCardNames(v).filter((n) => !have.has(nameKey(n)) && !have.has(nameKey(n).split(" // ")[0] ?? ""));
}

/**
 * Near-miss combos, closest first (fewest missing cards, then Spellbook popularity).
 * `almostIncluded*` lists from Spellbook are filtered again against the deck so a variant is
 * never reported as missing a card the deck actually contains.
 */
export function nearMissCombos(results: FindMyCombosResults, deckNames: readonly string[], limit = 25): NearMissCombo[] {
  const have = deckNameSet(deckNames);
  const buckets: [SpellbookVariant[], NearMissCombo["reason"]][] = [
    [results.almostIncluded, "almost"],
    [results.almostIncludedByAddingColors, "adding-colors"],
    [results.almostIncludedByChangingCommanders, "changing-commanders"],
    [results.almostIncludedByAddingColorsAndChangingCommanders, "adding-colors-and-changing-commanders"],
  ];
  const seen = new Set<string>();
  const out: NearMissCombo[] = [];
  for (const [variants, reason] of buckets) {
    for (const variant of variants) {
      if (seen.has(variant.id)) continue;
      seen.add(variant.id);
      const missing = missingCards(variant, have);
      if (missing.length === 0) continue;
      const match = variantToStrategyMatch(variant);
      out.push({ variant, match: { ...match, rationale: `${match.rationale}; missing ${missing.join(", ")}` }, missing, reason });
    }
  }
  // In-identity near misses first (a deck can actually add those), then fewest missing, then popularity.
  const reasonRank: Record<NearMissCombo["reason"], number> = { almost: 0, "changing-commanders": 1, "adding-colors": 2, "adding-colors-and-changing-commanders": 3 };
  out.sort(
    (a, b) => reasonRank[a.reason] - reasonRank[b.reason] || a.missing.length - b.missing.length || (b.variant.popularity ?? 0) - (a.variant.popularity ?? 0),
  );
  return out.slice(0, limit);
}

/** Confirmed combos as StrategyMatches, most popular first. */
export function includedCombos(results: FindMyCombosResults): StrategyMatch[] {
  return [...results.included]
    .sort((a, b) => (b.popularity ?? 0) - (a.popularity ?? 0))
    .map(variantToStrategyMatch);
}
