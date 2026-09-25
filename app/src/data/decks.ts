import { z } from "zod";
import type { Deck, DeckEntry, Format, ImportFormat } from "../core/types";
import type { DbClient } from "./db";

/**
 * Saved-deck reads over `decks` / `deck_entries` (schema v1). Writes go through the Rust
 * `deck_save` / `deck_delete` commands (`src/bridge/decks.ts`, D-009).
 */

const DeckRow = z.object({
  id: z.string(),
  name: z.string(),
  format: z.string().nullable(),
  source_format: z.string(),
  raw: z.string(),
  created_at: z.string(),
  updated_at: z.string(),
});

const SummaryRow = DeckRow.omit({ raw: true }).extend({
  main_count: z.number(),
  commander_names: z.string().nullable(),
  unresolved: z.number(),
});

const EntryRow = z.object({
  section: z.string(),
  position: z.number(),
  name: z.string(),
  quantity: z.number(),
  set_code: z.string().nullable(),
  collector_number: z.string().nullable(),
  oracle_id: z.string().nullable(),
});

export interface DeckSummary {
  id: string;
  name: string;
  format?: Format;
  sourceFormat: ImportFormat;
  /** Cards in the main deck (sum of quantities), excluding commanders. */
  mainCount: number;
  commanders: string[];
  /** Entries saved without an oracle id (still need the fixer). */
  unresolved: number;
  createdAt: string;
  updatedAt: string;
}

const FORMATS: readonly Format[] = ["commander", "modern", "standard", "pioneer", "legacy", "vintage", "pauper", "brawl", "casual"];
const IMPORT_FORMATS: readonly ImportFormat[] = ["manabox-csv", "tcgplayer-csv", "moxfield-csv", "decklist-text", "arena-text", "unknown"];

function asFormat(s: string | null): Format | undefined {
  return FORMATS.find((f) => f === s);
}
function asImportFormat(s: string): ImportFormat {
  return IMPORT_FORMATS.find((f) => f === s) ?? "unknown";
}

export async function listDecks(db: DbClient): Promise<DeckSummary[]> {
  const rows = await db.query(`
    SELECT d.id, d.name, d.format, d.source_format, d.created_at, d.updated_at,
           COALESCE((SELECT SUM(quantity) FROM deck_entries e WHERE e.deck_id = d.id AND e.section = 'main'), 0) AS main_count,
           (SELECT group_concat(name, ' / ') FROM (
              SELECT name FROM deck_entries e WHERE e.deck_id = d.id AND e.section = 'commanders' ORDER BY position
           )) AS commander_names,
           (SELECT COUNT(*) FROM deck_entries e WHERE e.deck_id = d.id AND e.oracle_id IS NULL AND e.section IN ('commanders', 'main')) AS unresolved
    FROM decks d
    ORDER BY d.updated_at DESC`);
  return rows.map((raw) => {
    const r = SummaryRow.parse(raw);
    return {
      id: r.id,
      name: r.name,
      format: asFormat(r.format),
      sourceFormat: asImportFormat(r.source_format),
      mainCount: r.main_count,
      commanders: r.commander_names ? r.commander_names.split(" / ") : [],
      unresolved: r.unresolved,
      createdAt: r.created_at,
      updatedAt: r.updated_at,
    };
  });
}

function toEntry(r: z.infer<typeof EntryRow>): DeckEntry {
  return {
    name: r.name,
    quantity: r.quantity,
    setCode: r.set_code ?? undefined,
    collectorNumber: r.collector_number ?? undefined,
    oracleId: r.oracle_id ?? undefined,
  };
}

/** Full deck, or undefined when the id is unknown. */
export async function getDeck(db: DbClient, id: string): Promise<(Deck & { createdAt: string; updatedAt: string }) | undefined> {
  const deckRows = await db.query(`SELECT id, name, format, source_format, raw, created_at, updated_at FROM decks WHERE id = ?1`, [id]);
  const first = deckRows[0];
  if (!first) return undefined;
  const d = DeckRow.parse(first);
  const entryRows = await db.query(
    `SELECT section, position, name, quantity, set_code, collector_number, oracle_id FROM deck_entries WHERE deck_id = ?1 ORDER BY section, position`,
    [id],
  );
  const deck: Deck & { createdAt: string; updatedAt: string } = {
    id: d.id,
    name: d.name,
    format: asFormat(d.format),
    commanders: [],
    main: [],
    sideboard: [],
    extra: {},
    source: { format: asImportFormat(d.source_format), raw: d.raw },
    createdAt: d.created_at,
    updatedAt: d.updated_at,
  };
  for (const raw of entryRows) {
    const r = EntryRow.parse(raw);
    const entry = toEntry(r);
    if (r.section === "commanders") deck.commanders.push(entry);
    else if (r.section === "main") deck.main.push(entry);
    else if (r.section === "sideboard") deck.sideboard.push(entry);
    else if (r.section.startsWith("extra:")) (deck.extra[r.section.slice("extra:".length)] ??= []).push(entry);
  }
  return deck;
}
