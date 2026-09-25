import { invoke } from "@tauri-apps/api/core";
import { z } from "zod";
import { FindMyCombosResultsSchema } from "../core/strategy/spellbook";
import type { Deck } from "../core/types";

/**
 * Commander Spellbook `find-my-combos` through the Rust client (`rust/spellbook_api.rs`):
 * ≤ 80 req/min, 429-aware, 24 h on-disk cache, stale-on-offline (Q-013 default online path).
 * Credit Spellbook wherever these results are shown (their API guideline).
 */

export const DeckCardSchema = z.object({ card: z.string(), quantity: z.number().int().positive() });
export type DeckCard = z.infer<typeof DeckCardSchema>;

export const CombosEnvelopeSchema = z.object({
  key: z.string(),
  fetchedAt: z.string(),
  fetchedAtUnix: z.number(),
  cached: z.boolean(),
  stale: z.boolean(),
  warning: z.string().nullable(),
  request: z.object({ main: z.array(DeckCardSchema), commanders: z.array(DeckCardSchema) }),
  results: FindMyCombosResultsSchema,
});
export type CombosEnvelope = z.infer<typeof CombosEnvelopeSchema>;

export const ComboCacheStatusSchema = z.object({
  dir: z.string(),
  files: z.number(),
  bytes: z.number(),
  ttlHours: z.number(),
});
export type ComboCacheStatus = z.infer<typeof ComboCacheStatusSchema>;

/** Collapse a deck into the request shape (names as resolved; quantities merged per name). */
export function deckToSpellbookRequest(deck: Pick<Deck, "main" | "commanders">): { main: DeckCard[]; commanders: DeckCard[] } {
  const merge = (entries: readonly { name: string; quantity: number }[]) => {
    const byName = new Map<string, number>();
    for (const e of entries) byName.set(e.name, (byName.get(e.name) ?? 0) + Math.max(1, e.quantity));
    return [...byName].map(([card, quantity]) => ({ card, quantity }));
  };
  return { main: merge(deck.main), commanders: merge(deck.commanders) };
}

export async function findMyCombos(
  req: { main: DeckCard[]; commanders?: DeckCard[] },
  opts: { forceRefresh?: boolean } = {},
): Promise<CombosEnvelope> {
  return CombosEnvelopeSchema.parse(
    await invoke("find_my_combos", { main: req.main, commanders: req.commanders ?? [], forceRefresh: opts.forceRefresh ?? false }),
  );
}

export async function comboCacheStatus(): Promise<ComboCacheStatus> {
  return ComboCacheStatusSchema.parse(await invoke("combo_cache_status"));
}

export async function comboCacheClear(): Promise<number> {
  return z.number().parse(await invoke("combo_cache_clear"));
}
