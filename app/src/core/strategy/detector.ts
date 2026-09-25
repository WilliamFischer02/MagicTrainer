import type { CardOracle, Deck, DeckEntry, StrategyMatch } from "../types";
import { PATTERNS, deckShape, type DeckShape, type PatternDef, type RoleDef } from "./patterns";

export interface ResolvedCard {
  entry: DeckEntry;
  card: CardOracle;
}

/** Resolve deck entries against a card lookup. Unresolved names are returned separately — never silently dropped. */
export function resolveDeck(
  deck: Deck,
  lookup: (name: string) => CardOracle | undefined,
): { cards: ResolvedCard[]; unresolved: string[] } {
  const cards: ResolvedCard[] = [];
  const unresolved: string[] = [];
  for (const entry of [...deck.commanders, ...deck.main]) {
    const card = lookup(entry.name);
    if (card) cards.push({ entry, card });
    else unresolved.push(entry.name);
  }
  return { cards, unresolved };
}

export function roleMatches(role: RoleDef, card: CardOracle): boolean {
  if (role.type && !role.type.test(card.typeLine)) return false;
  if (role.custom && !role.custom(card)) return false;
  const byTag = role.tags?.some((t) => card.oracleTags.includes(t)) ?? false;
  const text = (card.oracleText ?? "").toLowerCase();
  const byText = role.text?.some((re) => re.test(text)) ?? false;
  // A role with neither tags nor text is purely structural (type/custom) and matched above.
  if (!role.tags && !role.text) return true;
  return byTag || byText;
}

export function scorePattern(pattern: PatternDef, cards: ResolvedCard[], shape: DeckShape = deckShape(cards.map((rc) => ({ card: rc.card, quantity: rc.entry.quantity })))): StrategyMatch | null {
  if (pattern.gate && !pattern.gate(shape)) return null;
  const roles: Record<string, string[]> = {};
  let earned = 0;
  let possible = 0;
  for (const role of pattern.roles) {
    possible += role.weight;
    const hits = cards.filter((rc) => roleMatches(role, rc.card));
    const qty = hits.reduce((n, rc) => n + rc.entry.quantity, 0);
    if (qty >= role.min) {
      roles[role.id] = hits.map((h) => h.card.name);
      // Diminishing returns past 2x the minimum.
      earned += role.weight * Math.min(1, 0.5 + qty / (2 * role.min));
    }
  }
  const missingRequired = pattern.required.filter((r) => !(r in roles));
  if (missingRequired.length) return null;
  // `anyOf`: at least one of these roles must also be filled (e.g. Voltron needs protection OR evasion).
  if (pattern.anyOf?.length && !pattern.anyOf.some((r) => r in roles)) return null;
  const confidence = Math.round((earned / possible) * 100) / 100;
  const rationale = pattern.roles
    .map((r) => `${r.label}: ${roles[r.id]?.length ?? 0} card(s)`)
    .join("; ");
  return { patternId: pattern.id, label: pattern.label, confidence, roles, rationale };
}

/** Run every pattern; return matches sorted by confidence. */
export function detectStrategies(cards: ResolvedCard[], patterns: PatternDef[] = PATTERNS): StrategyMatch[] {
  const shape = deckShape(cards.map((rc) => ({ card: rc.card, quantity: rc.entry.quantity })));
  return patterns
    .map((p) => scorePattern(p, cards, shape))
    .filter((m): m is StrategyMatch => m !== null)
    .sort((a, b) => b.confidence - a.confidence);
}
