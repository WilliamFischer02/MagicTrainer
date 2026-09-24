import Papa from "papaparse";
import type { CollectionEntry, ImportFormat } from "../types";

/**
 * Collection CSV parsers. Column specs verified 2026-09-24 against the
 * transmute-mtg format catalogue (knowledge/import-formats/) and ManaBox exports.
 *
 * ManaBox:   Name,Set code,Set name,Collector number,Foil,Rarity,Quantity,ManaBox ID,Scryfall ID,Purchase price,Misprint,Altered,Condition,Language,Purchase price currency
 *            (ManaBox emits different subsets depending on binder/list settings — match by header NAME, never by position.)
 * TCGPlayer: Quantity,Name,Simple Name,Set,Card Number,Set Code,Printing,Condition,Language,Rarity,Product ID,SKU
 * Moxfield:  Count,Tradelist Count,Name,Edition,Condition,Language,Foil,Alter,Proxy,Purchase Price,Collector Number
 */

type Row = Record<string, string>;

function norm(h: string): string {
  return h.trim().toLowerCase().replace(/[\s_]+/g, " ");
}

function pick(row: Row, ...keys: string[]): string | undefined {
  for (const k of keys) {
    const found = Object.keys(row).find((h) => norm(h) === norm(k));
    if (found !== undefined && row[found] !== "") return row[found];
  }
  return undefined;
}

export function detectCollectionFormat(headers: string[]): ImportFormat {
  const h = new Set(headers.map(norm));
  if (h.has("simple name") || (h.has("product id") && h.has("sku"))) return "tcgplayer-csv";
  if (h.has("set code") && h.has("collector number") && h.has("quantity") && h.has("name")) return "manabox-csv";
  if (h.has("count") && h.has("edition")) return "moxfield-csv";
  return "unknown";
}

export function parseCollectionCsv(csv: string): { format: ImportFormat; entries: CollectionEntry[]; errors: string[] } {
  const result = Papa.parse<Row>(csv, { header: true, skipEmptyLines: true, transformHeader: (h) => h.trim() });
  const headers = result.meta.fields ?? [];
  const format = detectCollectionFormat(headers);
  const errors = result.errors.map((e) => `row ${e.row}: ${e.message}`);
  if (format === "unknown") {
    return { format, entries: [], errors: [...errors, `Unrecognized headers: ${headers.join(", ")}`] };
  }
  const entries: CollectionEntry[] = [];
  for (const row of result.data) {
    const e = rowToEntry(row, format);
    if (e) entries.push(e);
  }
  return { format, entries, errors };
}

function rowToEntry(row: Row, format: ImportFormat): CollectionEntry | null {
  const name = pick(row, "Simple Name", "Name", "Card Name");
  if (!name) return null;
  const qty = Number(pick(row, "Quantity", "Count") ?? "1");
  const foilRaw = (pick(row, "Foil", "Printing") ?? "").toLowerCase();
  const foil = ["foil", "etched", "foil_etched", "true"].includes(foilRaw);
  return {
    name: name.trim(),
    setCode: pick(row, "Set code", "Set Code", "Edition")?.toLowerCase(),
    setName: pick(row, "Set name", "Set"),
    collectorNumber: pick(row, "Collector number", "Collector Number", "Card Number"),
    scryfallId: pick(row, "Scryfall ID"),
    quantity: Number.isFinite(qty) && qty > 0 ? qty : 1,
    foil,
    condition: pick(row, "Condition"),
    language: pick(row, "Language"),
    source: { format, row },
  };
}
