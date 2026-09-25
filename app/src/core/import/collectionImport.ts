import { parseCollectionCsv } from "../parsers/collection";
import type { CollectionEntry, ImportFormat } from "../types";

/**
 * CSV text → collection entries ready for resolution + import. Merges duplicate rows
 * (same name / set / collector number / foil / condition / language) so ManaBox binders that
 * list a card twice do not double it. Framework-free; never throws on content.
 */

export interface ImportedCollection {
  format: ImportFormat;
  entries: CollectionEntry[];
  /** Rows that could not be parsed (row index + message). */
  errors: string[];
  warnings: string[];
  /** Sum of quantities. */
  totalCards: number;
  /** Rows merged into an earlier identical row. */
  merged: number;
}

function key(e: CollectionEntry): string {
  return [e.name.toLowerCase(), e.setCode ?? "", e.collectorNumber ?? "", e.foil ? "f" : "", (e.condition ?? "").toLowerCase(), (e.language ?? "").toLowerCase()].join("|");
}

export function importCollection(text: string, opts: { fileName?: string } = {}): ImportedCollection {
  const raw = text.replace(/^﻿/, "");
  const parsed = parseCollectionCsv(raw);
  const byKey = new Map<string, CollectionEntry>();
  let merged = 0;
  for (const e of parsed.entries) {
    const k = key(e);
    const existing = byKey.get(k);
    if (existing) {
      existing.quantity += e.quantity;
      merged += 1;
    } else {
      byKey.set(k, { ...e });
    }
  }
  const entries = [...byKey.values()];
  const warnings: string[] = [];
  if (parsed.format === "unknown") {
    warnings.push(
      `${opts.fileName ?? "This file"} does not look like a ManaBox, TCGplayer, or Moxfield CSV export. Expected a header row with card names and quantities.`,
    );
  }
  if (entries.length === 0 && parsed.format !== "unknown") warnings.push("The file parsed but contained no card rows.");
  if (merged > 0) warnings.push(`${merged} duplicate row${merged === 1 ? " was" : "s were"} merged into matching entries.`);
  const noSet = entries.filter((e) => !e.setCode && !e.scryfallId).length;
  if (noSet > 0) warnings.push(`${noSet} row${noSet === 1 ? " has" : "s have"} no set information; they will be matched by name only.`);
  return {
    format: parsed.format,
    entries,
    errors: parsed.errors,
    warnings,
    totalCards: entries.reduce((n, e) => n + e.quantity, 0),
    merged,
  };
}

/** True when a file name or first line suggests a collection CSV rather than a decklist. */
export function looksLikeCollectionCsv(text: string, fileName?: string): boolean {
  if (fileName && /\.csv$/i.test(fileName)) return true;
  const first = text.replace(/^﻿/, "").split(/\r?\n/, 1)[0] ?? "";
  return first.split(",").length >= 4 && /name/i.test(first) && /(quantity|count)/i.test(first);
}
