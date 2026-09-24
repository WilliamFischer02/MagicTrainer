import { z } from "zod";
import type { Deck, DeckEntry } from "../core/types";
import { NameIndex, type Resolution, type ResolveOptions } from "../core/resolve/resolver";
import type { DbClient } from "./db";

/**
 * Loads the in-memory `NameIndex` (D-010) from the card DB and resolves whole decks.
 * The projection is ~3.8 MB for 38.7k cards and builds in well under a second.
 */

const IndexRow = z.object({ oracle_id: z.string(), name: z.string(), layout: z.string() });

export async function loadNameIndex(db: DbClient): Promise<NameIndex> {
  const rows = await db.query(`SELECT oracle_id, name, layout FROM cards`);
  return new NameIndex(
    rows.map((r) => {
      const p = IndexRow.parse(r);
      return { oracleId: p.oracle_id, name: p.name, layout: p.layout };
    }),
  );
}

export interface DeckResolution {
  /** Same shape as the input deck with `oracleId` filled where resolved. */
  deck: Deck;
  /** One entry per distinct input name, in first-seen order. */
  resolutions: Resolution[];
  unresolved: Resolution[];
  /** Resolved with method "fuzzy" — worth a confirmation in the UI. */
  fuzzy: Resolution[];
}

/** Resolve every entry of a deck against the index; never drops an entry. */
export function resolveDeckNames(index: NameIndex, deck: Deck, opts?: ResolveOptions): DeckResolution {
  const byInput = new Map<string, Resolution>();
  const resolveEntry = (e: DeckEntry): DeckEntry => {
    let r = byInput.get(e.name);
    if (!r) {
      r = index.resolve(e.name, opts);
      byInput.set(e.name, r);
    }
    return r.oracleId ? { ...e, oracleId: r.oracleId } : { ...e };
  };
  const resolved: Deck = {
    ...deck,
    commanders: deck.commanders.map(resolveEntry),
    main: deck.main.map(resolveEntry),
    sideboard: deck.sideboard.map(resolveEntry),
    extra: Object.fromEntries(Object.entries(deck.extra).map(([k, v]) => [k, v.map(resolveEntry)])),
  };
  const resolutions = [...byInput.values()];
  return {
    deck: resolved,
    resolutions,
    unresolved: resolutions.filter((r) => !r.oracleId),
    fuzzy: resolutions.filter((r) => r.method === "fuzzy"),
  };
}
