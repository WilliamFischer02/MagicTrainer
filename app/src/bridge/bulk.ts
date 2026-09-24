import { invoke } from "@tauri-apps/api/core";
import { listen, type UnlistenFn } from "@tauri-apps/api/event";
import { z } from "zod";

/**
 * Bulk data commands (`import_bulk`, `db_status`, `scryfall_bulk_index`) and the
 * `bulk-progress` event stream. Payload shapes mirror `app/src-tauri/rust/{commands,progress,import}.rs`.
 */

export const BulkPart = z.enum(["oracle_cards", "printings", "rulings", "oracle_tags", "spellbook"]);
export type BulkPart = z.infer<typeof BulkPart>;

export const ProgressSchema = z.object({
  stage: z.string(),
  done: z.number(),
  total: z.number().nullable(),
  message: z.string(),
  finished: z.boolean(),
});
export type Progress = z.infer<typeof ProgressSchema>;

export const DbStatusSchema = z.object({
  dbPath: z.string(),
  dataDir: z.string(),
  exists: z.boolean(),
  schemaVersion: z.string().nullable(),
  counts: z.record(z.string(), z.number()),
  meta: z.record(z.string(), z.string()),
});
export type DbStatus = z.infer<typeof DbStatusSchema>;

export const PartReportSchema = z.object({
  part: z.string(),
  file: z.string(),
  skipped: z.string().nullable(),
  rows: z.number(),
  ignored: z.number(),
  seconds: z.number(),
});

export const BulkImportResultSchema = z.object({
  downloaded: z.array(
    z.object({
      part: BulkPart,
      url: z.string(),
      file: z.string(),
      bytes: z.number(),
      updatedAt: z.string().nullable(),
    }),
  ),
  report: z.object({
    parts: z.array(PartReportSchema),
    counts: z.record(z.string(), z.number()),
  }),
  seconds: z.number(),
});
export type BulkImportResult = z.infer<typeof BulkImportResultSchema>;

export const BulkEntrySchema = z.object({
  type: z.string(),
  name: z.string(),
  updated_at: z.string(),
  jsonl_download_uri: z.string().nullable(),
  download_uri: z.string().nullable(),
  compressed_size: z.number().nullable(),
});
export type BulkEntry = z.infer<typeof BulkEntrySchema>;

export type ImportSource = { kind: "dir"; dir?: string } | { kind: "download" };

export async function dbStatus(): Promise<DbStatus> {
  return DbStatusSchema.parse(await invoke("db_status"));
}

export async function importBulk(source: ImportSource, parts?: BulkPart[]): Promise<BulkImportResult> {
  return BulkImportResultSchema.parse(await invoke("import_bulk", { source, parts: parts ?? null }));
}

export async function scryfallBulkIndex(): Promise<BulkEntry[]> {
  return z.array(BulkEntrySchema).parse(await invoke("scryfall_bulk_index"));
}

/** Subscribe to importer progress. Returns the unlisten function. */
export function onBulkProgress(handler: (p: Progress) => void): Promise<UnlistenFn> {
  return listen<unknown>("bulk-progress", (event) => {
    const parsed = ProgressSchema.safeParse(event.payload);
    if (parsed.success) handler(parsed.data);
    else console.error("bulk-progress: malformed payload", parsed.error, event.payload);
  });
}
