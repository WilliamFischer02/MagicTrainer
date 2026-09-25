import { z } from "zod";
import type { NameIndex } from "../core/resolve/resolver";
import type { CardOracle, CollectionEntry, Color } from "../core/types";
import { rowToCardOracle } from "./cards";
import { chunk, placeholders, type DbClient, type SqlParam } from "./db";

/**
 * Collection: resolution of CSV rows to printings/oracle ids, and reads over the `collection`
 * table joined to `cards`. Writes go through the Rust `collection_import` command.
 */

// ---- resolution ------------------------------------------------------------------------

export interface ResolvedCollectionRow {
  entry: CollectionEntry;
  printingId?: string;
  oracleId?: string;
  /** How the row was matched. */
  method: "scryfall-id" | "set-number" | "name" | "unresolved";
}

const PrintingRow = z.object({ id: z.string(), oracle_id: z.string(), set_code: z.string(), collector_number: z.string() });

/**
 * Resolve collection rows: Scryfall printing id → (set, collector number) → name via the NameIndex.
 * Never drops a row; unresolved rows keep `method: "unresolved"`.
 */
export async function resolveCollection(db: DbClient, index: NameIndex, entries: readonly CollectionEntry[]): Promise<ResolvedCollectionRow[]> {
  const byPrintingId = new Map<string, { oracleId: string }>();
  const ids = [...new Set(entries.map((e) => e.scryfallId).filter((x): x is string => !!x))];
  for (const part of chunk(ids)) {
    const rows = await db.query(`SELECT id, oracle_id, set_code, collector_number FROM printings WHERE id IN (${placeholders(part.length)})`, part);
    for (const raw of rows) {
      const p = PrintingRow.parse(raw);
      byPrintingId.set(p.id, { oracleId: p.oracle_id });
    }
  }
  const bySetCn = new Map<string, { id: string; oracleId: string }>();
  const pairs = [...new Set(entries.filter((e) => e.setCode && e.collectorNumber && !(e.scryfallId && byPrintingId.has(e.scryfallId))).map((e) => `${e.setCode!.toLowerCase()}|${e.collectorNumber!}`))];
  for (const part of chunk(pairs, 200)) {
    const params: SqlParam[] = [];
    const clauses = part.map((k) => {
      const [set, cn] = k.split("|");
      params.push(set!, cn!);
      return `(set_code = ?${params.length - 1} AND collector_number = ?${params.length})`;
    });
    const rows = await db.query(`SELECT id, oracle_id, set_code, collector_number FROM printings WHERE ${clauses.join(" OR ")}`, params);
    for (const raw of rows) {
      const p = PrintingRow.parse(raw);
      bySetCn.set(`${p.set_code}|${p.collector_number}`, { id: p.id, oracleId: p.oracle_id });
    }
  }
  return entries.map((entry) => {
    if (entry.scryfallId) {
      const hit = byPrintingId.get(entry.scryfallId);
      if (hit) return { entry, printingId: entry.scryfallId, oracleId: hit.oracleId, method: "scryfall-id" };
    }
    if (entry.setCode && entry.collectorNumber) {
      const hit = bySetCn.get(`${entry.setCode.toLowerCase()}|${entry.collectorNumber}`);
      if (hit) return { entry, printingId: hit.id, oracleId: hit.oracleId, method: "set-number" };
    }
    const r = index.resolve(entry.name);
    if (r.oracleId) return { entry, oracleId: r.oracleId, method: "name" };
    return { entry, method: "unresolved" };
  });
}

// ---- reads -------------------------------------------------------------------------------

const SummaryRow = z.object({
  rows: z.number(),
  cards: z.number(),
  distinct_oracle: z.number(),
  unresolved: z.number(),
  value_usd: z.number().nullable(),
});

export interface CollectionSummary {
  rows: number;
  cards: number;
  distinctCards: number;
  unresolvedRows: number;
  /** Sum of quantity × cheapest known USD price (rough collection value). */
  valueUsd?: number;
  importedAt?: string;
  sourceFormat?: string;
}

export async function collectionSummary(db: DbClient): Promise<CollectionSummary> {
  const rows = await db.query(`
    SELECT COUNT(*) AS rows, COALESCE(SUM(quantity), 0) AS cards,
           COUNT(DISTINCT oracle_id) AS distinct_oracle,
           COALESCE(SUM(CASE WHEN oracle_id IS NULL THEN 1 ELSE 0 END), 0) AS unresolved,
           (SELECT SUM(c.quantity * COALESCE(p.price_usd, (SELECT MIN(p2.price_usd) FROM printings p2 WHERE p2.oracle_id = c.oracle_id AND p2.digital = 0)))
              FROM collection c LEFT JOIN printings p ON p.id = c.printing_id WHERE c.oracle_id IS NOT NULL) AS value_usd
    FROM collection`);
  const r = SummaryRow.parse(rows[0]);
  const meta = await db.query(`SELECT key, value FROM meta WHERE key IN ('collection.imported_at', 'collection.source_format')`);
  const m = Object.fromEntries(meta.map((x) => [String(x.key), String(x.value)]));
  return {
    rows: r.rows,
    cards: r.cards,
    distinctCards: r.distinct_oracle,
    unresolvedRows: r.unresolved,
    valueUsd: r.value_usd ?? undefined,
    importedAt: m["collection.imported_at"],
    sourceFormat: m["collection.source_format"],
  };
}

export interface CollectionFilter {
  /** FTS-style prefix search on the card name. */
  text?: string;
  /** Any of these colors in the card's color identity; "C" = colorless. */
  colors?: (Color | "C")[];
  /** Type word that must appear in the type line, e.g. "Creature". */
  type?: string;
  /** Oracle-tag slug (ancestor-expanded). */
  tag?: string;
  sort?: "name" | "quantity" | "price" | "cmc";
  limit?: number;
  offset?: number;
}

export interface OwnedCard {
  card: CardOracle;
  quantity: number;
  foilQuantity: number;
  /** Cheapest owned printing's USD price when known. */
  priceUsd?: number;
  sets: string[];
}

const OwnedExtra = z.object({
  owned_qty: z.number(),
  owned_foil: z.number(),
  owned_price: z.number().nullable(),
  owned_sets: z.string().nullable(),
});

/** Cards in the collection grouped by oracle id, with quantity, joined to `cards`. */
export async function listCollectionCards(db: DbClient, f: CollectionFilter = {}): Promise<OwnedCard[]> {
  const where: string[] = ["col.oracle_id IS NOT NULL"];
  const params: SqlParam[] = [];
  const p = (v: SqlParam) => {
    params.push(v);
    return `?${params.length}`;
  };
  const text = f.text?.trim();
  if (text) {
    where.push(`c.name LIKE ${p(`%${text.replace(/[%_]/g, "")}%`)}`);
  }
  if (f.colors?.length) {
    const parts = f.colors.map((c) => (c === "C" ? `c.color_identity = '[]'` : `instr(c.color_identity, ${p(`"${c}"`)}) > 0`));
    where.push(`(${parts.join(" OR ")})`);
  }
  if (f.type) where.push(`c.type_line LIKE ${p(`%${f.type.replace(/[%_]/g, "")}%`)}`);
  if (f.tag) {
    where.push(`EXISTS (SELECT 1 FROM card_oracle_tags cot JOIN oracle_tag_ancestors a ON a.tag_id = cot.tag_id JOIN oracle_tags t ON t.id = a.ancestor_id WHERE cot.oracle_id = c.oracle_id AND t.slug = ${p(f.tag)})`);
  }
  const order =
    f.sort === "quantity" ? "owned_qty DESC, c.name" : f.sort === "price" ? "owned_price DESC NULLS LAST, c.name" : f.sort === "cmc" ? "c.cmc, c.name" : "c.name";
  const limit = Math.max(1, Math.min(500, f.limit ?? 60));
  const offset = Math.max(0, f.offset ?? 0);
  const sql = `
    SELECT c.oracle_id, c.name, c.layout, c.mana_cost, c.cmc, c.type_line, c.oracle_text,
           c.colors, c.color_identity, c.keywords, c.power, c.toughness, c.loyalty,
           c.legalities, c.edhrec_rank, c.game_changer, c.repr_printing_id,
           c.image_small, c.image_normal, c.image_large, c.image_art_crop,
           c.produced_mana, c.prices, c.purchase_uris, c.scryfall_uri,
           NULL AS price_usd_min, NULL AS tags_json,
           SUM(col.quantity) AS owned_qty,
           SUM(CASE WHEN col.foil = 1 THEN col.quantity ELSE 0 END) AS owned_foil,
           MIN(p.price_usd) AS owned_price,
           group_concat(DISTINCT col.set_code) AS owned_sets
    FROM collection col
    JOIN cards c ON c.oracle_id = col.oracle_id
    LEFT JOIN printings p ON p.id = col.printing_id
    WHERE ${where.join(" AND ")}
    GROUP BY c.oracle_id
    ORDER BY ${order}
    LIMIT ${limit} OFFSET ${offset}`;
  const rows = await db.query(sql, params);
  return rows.map((raw) => {
    const extra = OwnedExtra.parse(raw);
    return {
      card: rowToCardOracle(raw),
      quantity: extra.owned_qty,
      foilQuantity: extra.owned_foil,
      priceUsd: extra.owned_price ?? undefined,
      sets: (extra.owned_sets ?? "").split(",").filter(Boolean),
    };
  });
}

/** Owned quantity per oracle id (for "owned first" suggestions and deck rows). */
export async function ownedQuantities(db: DbClient, oracleIds: readonly string[]): Promise<Map<string, number>> {
  const out = new Map<string, number>();
  const unique = [...new Set(oracleIds)];
  for (const part of chunk(unique)) {
    const rows = await db.query(`SELECT oracle_id, SUM(quantity) AS qty FROM collection WHERE oracle_id IN (${placeholders(part.length)}) GROUP BY oracle_id`, part);
    for (const r of rows) out.set(String(r.oracle_id), Number(r.qty));
  }
  return out;
}

/** Rows that never matched a card (for a fixer / report). */
export async function unresolvedCollectionRows(db: DbClient, limit = 200): Promise<{ name: string; setCode?: string; collectorNumber?: string; quantity: number }[]> {
  const rows = await db.query(`SELECT name, set_code, collector_number, quantity FROM collection WHERE oracle_id IS NULL ORDER BY name LIMIT ?1`, [limit]);
  return rows.map((r) => ({
    name: String(r.name),
    setCode: r.set_code ? String(r.set_code) : undefined,
    collectorNumber: r.collector_number ? String(r.collector_number) : undefined,
    quantity: Number(r.quantity),
  }));
}
