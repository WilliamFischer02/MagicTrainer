import { invoke } from "@tauri-apps/api/core";
import { z } from "zod";
import type { ResolvedCollectionRow } from "../data/collection";

/** Collection write commands (`app/src-tauri/rust/collection.rs`). Reads are SQL in `src/data/collection.ts`. */

export const CollectionImportedSchema = z.object({
  inserted: z.number(),
  totalRows: z.number(),
  totalCards: z.number(),
  importedAt: z.string(),
});
export type CollectionImported = z.infer<typeof CollectionImportedSchema>;

export type ImportMode = "replace" | "append";

export async function importCollectionRows(rows: readonly ResolvedCollectionRow[], sourceFormat: string, mode: ImportMode = "replace"): Promise<CollectionImported> {
  const payload = rows.map((r) => ({
    printingId: r.printingId ?? null,
    oracleId: r.oracleId ?? null,
    name: r.entry.name,
    setCode: r.entry.setCode ?? null,
    collectorNumber: r.entry.collectorNumber ?? null,
    quantity: r.entry.quantity,
    foil: r.entry.foil,
    condition: r.entry.condition ?? null,
    language: r.entry.language ?? null,
    rawJson: JSON.stringify(r.entry.source.row),
  }));
  return CollectionImportedSchema.parse(await invoke("collection_import", { rows: payload, sourceFormat, mode }));
}

export async function clearCollection(): Promise<number> {
  return z.number().parse(await invoke("collection_clear"));
}
