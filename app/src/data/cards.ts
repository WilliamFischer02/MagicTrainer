import { z } from "zod";
import type { CardOracle, Color } from "../core/types";
import { chunk, placeholders, type DbClient } from "./db";

/**
 * Card queries over the schema in `app/src-tauri/rust/db.rs` (v1), mapped to `core` types.
 * Every row is validated with Zod at the boundary; JSON columns are parsed here.
 *
 * Oracle tags: a card's tag set is its DIRECT taggings plus every ANCESTOR tag
 * (`oracle_tag_ancestors` closure), so a pattern asking for `sacrifice-outlet` also sees
 * cards tagged with a more specific child slug.
 */

const JsonText = z.string();
const Legality = z.enum(["legal", "not_legal", "restricted", "banned"]);

export const CardRowSchema = z.object({
  oracle_id: z.string(),
  name: z.string(),
  layout: z.string(),
  mana_cost: z.string().nullable(),
  cmc: z.number(),
  type_line: z.string(),
  oracle_text: z.string().nullable(),
  colors: JsonText,
  color_identity: JsonText,
  keywords: JsonText,
  power: z.string().nullable(),
  toughness: z.string().nullable(),
  loyalty: z.string().nullable(),
  legalities: JsonText,
  edhrec_rank: z.number().nullable(),
  game_changer: z.number(),
  repr_printing_id: z.string().nullable(),
  image_small: z.string().nullable(),
  image_normal: z.string().nullable(),
  image_large: z.string().nullable(),
  image_art_crop: z.string().nullable(),
  produced_mana: JsonText.nullable(),
  prices: JsonText.nullable(),
  price_usd_min: z.number().nullable(),
  purchase_uris: JsonText.nullable(),
  scryfall_uri: z.string().nullable(),
  tags_json: JsonText.nullable(),
});
export type CardRow = z.infer<typeof CardRowSchema>;

const COLORS = new Set<string>(["W", "U", "B", "R", "G"]);

function parseJson<T>(text: string | null | undefined, schema: z.ZodType<T>, fallback: T): T {
  if (!text) return fallback;
  const parsed = schema.safeParse(JSON.parse(text));
  return parsed.success ? parsed.data : fallback;
}

export function rowToCardOracle(raw: unknown): CardOracle {
  const r = CardRowSchema.parse(raw);
  const colors = parseJson(r.colors, z.array(z.string()), []).filter((c): c is Color => COLORS.has(c));
  const identity = parseJson(r.color_identity, z.array(z.string()), []).filter((c): c is Color => COLORS.has(c));
  const legalitiesRaw = parseJson(r.legalities, z.record(z.string(), z.string()), {});
  const legalities: CardOracle["legalities"] = {};
  for (const [format, value] of Object.entries(legalitiesRaw)) {
    const v = Legality.safeParse(value);
    if (v.success) legalities[format] = v.data;
  }
  const images = {
    small: r.image_small ?? undefined,
    normal: r.image_normal ?? undefined,
    large: r.image_large ?? undefined,
    art_crop: r.image_art_crop ?? undefined,
  };
  const priceNum = z.union([z.string(), z.number()]).nullable().optional().transform((v) => {
    if (v === null || v === undefined) return undefined;
    const n = typeof v === "number" ? v : Number.parseFloat(v);
    return Number.isFinite(n) ? n : undefined;
  });
  const prices = parseJson(r.prices, z.object({ usd: priceNum, usd_foil: priceNum }).partial(), {});
  const uris = parseJson(r.purchase_uris, z.object({ cardkingdom: z.string().optional(), tcgplayer: z.string().optional(), cardmarket: z.string().optional() }).partial(), {});
  return {
    oracleId: r.oracle_id,
    name: r.name,
    manaCost: r.mana_cost ?? undefined,
    cmc: r.cmc,
    typeLine: r.type_line,
    oracleText: r.oracle_text ?? undefined,
    colors,
    colorIdentity: identity,
    keywords: parseJson(r.keywords, z.array(z.string()), []),
    power: r.power ?? undefined,
    toughness: r.toughness ?? undefined,
    loyalty: r.loyalty ?? undefined,
    legalities,
    oracleTags: parseJson(r.tags_json, z.array(z.string()), []),
    edhrecRank: r.edhrec_rank ?? undefined,
    gameChanger: r.game_changer === 1,
    imageUris: Object.values(images).some(Boolean) ? images : undefined,
    printingId: r.repr_printing_id ?? undefined,
    layout: r.layout,
    producedMana: parseJson(r.produced_mana, z.array(z.string()), []),
    prices:
      prices.usd !== undefined || prices.usd_foil !== undefined || r.price_usd_min !== null
        ? { usd: prices.usd, usdFoil: prices.usd_foil, usdMin: r.price_usd_min ?? undefined }
        : undefined,
    purchaseUris: Object.keys(uris).length ? uris : undefined,
    scryfallUri: r.scryfall_uri ?? undefined,
  };
}

const CARD_SELECT = `
  SELECT c.oracle_id, c.name, c.layout, c.mana_cost, c.cmc, c.type_line, c.oracle_text,
         c.colors, c.color_identity, c.keywords, c.power, c.toughness, c.loyalty,
         c.legalities, c.edhrec_rank, c.game_changer, c.repr_printing_id,
         c.image_small, c.image_normal, c.image_large, c.image_art_crop,
         c.produced_mana, c.prices, c.purchase_uris, c.scryfall_uri,
         (SELECT MIN(p.price_usd) FROM printings p WHERE p.oracle_id = c.oracle_id AND p.price_usd IS NOT NULL AND p.digital = 0) AS price_usd_min,
         (SELECT json_group_array(slug) FROM (
            SELECT DISTINCT t.slug
            FROM card_oracle_tags cot
            JOIN oracle_tag_ancestors a ON a.tag_id = cot.tag_id
            JOIN oracle_tags t ON t.id = a.ancestor_id
            WHERE cot.oracle_id = c.oracle_id
         )) AS tags_json
  FROM cards c`;

/** Fetch full cards by oracle id. Order of the result is not guaranteed; use the returned Map. */
export async function getCardsByOracleIds(db: DbClient, oracleIds: readonly string[]): Promise<Map<string, CardOracle>> {
  const out = new Map<string, CardOracle>();
  const unique = [...new Set(oracleIds)];
  for (const ids of chunk(unique)) {
    const rows = await db.query(`${CARD_SELECT} WHERE c.oracle_id IN (${placeholders(ids.length)})`, ids);
    for (const row of rows) {
      const card = rowToCardOracle(row);
      out.set(card.oracleId, card);
    }
  }
  return out;
}

export async function getCardByOracleId(db: DbClient, oracleId: string): Promise<CardOracle | undefined> {
  return (await getCardsByOracleIds(db, [oracleId])).get(oracleId);
}

const FtsRow = z.object({ oracle_id: z.string(), name: z.string() });

/** Autocomplete over `cards_fts` (prefix match on every token). Returns at most `limit` names. */
export async function searchCardNames(db: DbClient, text: string, limit = 12): Promise<{ oracleId: string; name: string }[]> {
  const tokens = text
    .trim()
    .split(/\s+/)
    .map((t) => t.replace(/["*]/g, ""))
    .filter(Boolean);
  if (tokens.length === 0) return [];
  const match = tokens.map((t) => `"${t}"*`).join(" ");
  const rows = await db.query(
    `SELECT oracle_id, name FROM cards_fts WHERE cards_fts MATCH ?1 ORDER BY rank, length(name) LIMIT ?2`,
    [match, limit],
  );
  return rows.map((r) => {
    const p = FtsRow.parse(r);
    return { oracleId: p.oracle_id, name: p.name };
  });
}

const RulingRow = z.object({ published_at: z.string(), source: z.string().nullable(), comment: z.string() });
export interface Ruling {
  publishedAt: string;
  source?: string;
  comment: string;
}

export async function getRulings(db: DbClient, oracleId: string): Promise<Ruling[]> {
  const rows = await db.query(`SELECT published_at, source, comment FROM rulings WHERE oracle_id = ?1 ORDER BY published_at`, [oracleId]);
  return rows.map((r) => {
    const p = RulingRow.parse(r);
    return { publishedAt: p.published_at, source: p.source ?? undefined, comment: p.comment };
  });
}

const MetaRow = z.object({ key: z.string(), value: z.string() });

/** `meta` table as a plain object (schema version, import timestamps). */
export async function getMeta(db: DbClient): Promise<Record<string, string>> {
  const rows = await db.query(`SELECT key, value FROM meta`);
  return Object.fromEntries(rows.map((r) => {
    const p = MetaRow.parse(r);
    return [p.key, p.value];
  }));
}
