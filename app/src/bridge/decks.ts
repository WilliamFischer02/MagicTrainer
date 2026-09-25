import { invoke } from "@tauri-apps/api/core";
import { getCurrentWebview } from "@tauri-apps/api/webview";
import { open, save } from "@tauri-apps/plugin-dialog";
import { z } from "zod";
import type { Deck } from "../core/types";

/**
 * Deck import + persistence commands (`app/src-tauri/rust/decks.rs`). Files arrive as
 * paths (dialog or Tauri drag-drop), so the text is read by Rust with a size/extension guard.
 */

export const ImportFileSchema = z.object({
  path: z.string(),
  fileName: z.string(),
  stem: z.string(),
  extension: z.string(),
  bytes: z.number(),
  text: z.string(),
});
export type ImportFile = z.infer<typeof ImportFileSchema>;

export const DeckSavedSchema = z.object({
  id: z.string(),
  entries: z.number(),
  created: z.boolean(),
  updatedAt: z.string(),
});
export type DeckSaved = z.infer<typeof DeckSavedSchema>;

export const IMPORT_FILTERS = [
  { name: "Decklists & collections", extensions: ["txt", "csv", "dec", "dek", "mwdeck", "cod"] },
  { name: "Text decklist", extensions: ["txt", "dec", "dek", "mwdeck"] },
  { name: "CSV export (ManaBox, TCGplayer, Moxfield)", extensions: ["csv"] },
];

export async function readImportFile(path: string): Promise<ImportFile> {
  return ImportFileSchema.parse(await invoke("read_import_file", { path }));
}

/** Native open dialog; resolves to the chosen paths (empty when cancelled). */
export async function pickImportFiles(): Promise<string[]> {
  const picked = await open({ multiple: true, directory: false, title: "Import deck or collection", filters: IMPORT_FILTERS });
  if (!picked) return [];
  return Array.isArray(picked) ? picked : [picked];
}

export type DropState = { kind: "over" } | { kind: "leave" } | { kind: "drop"; paths: string[] };

/**
 * Subscribe to OS file drops on the window. Tauri intercepts HTML5 drag-drop and emits paths
 * instead, so this is the only way to receive dropped files. Returns the unlisten function.
 */
export async function onFileDrop(handler: (state: DropState) => void): Promise<() => void> {
  return getCurrentWebview().onDragDropEvent((event) => {
    const p = event.payload;
    if (p.type === "over" || p.type === "enter") handler({ kind: "over" });
    else if (p.type === "leave") handler({ kind: "leave" });
    else if (p.type === "drop") handler({ kind: "drop", paths: p.paths });
  });
}

/** Persist a deck (insert or replace all entries). */
export async function saveDeck(deck: Deck): Promise<DeckSaved> {
  const payload = {
    id: deck.id,
    name: deck.name,
    format: deck.format ?? null,
    commanders: deck.commanders,
    main: deck.main,
    sideboard: deck.sideboard,
    extra: deck.extra,
    source: deck.source,
  };
  return DeckSavedSchema.parse(await invoke("deck_save", { deck: payload }));
}

export async function deleteDeck(id: string): Promise<boolean> {
  return z.boolean().parse(await invoke("deck_delete", { id }));
}

/** Save dialog + Rust write. Resolves to the path written, or null when the user cancelled. */
export async function saveTextFile(defaultName: string, text: string): Promise<string | null> {
  const path = await save({ title: "Export decklist", defaultPath: defaultName, filters: [{ name: "Text decklist", extensions: ["txt", "dec"] }] });
  if (!path) return null;
  await invoke("write_text_file", { path, text });
  return path;
}
