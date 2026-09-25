import { useQueryClient } from "@tanstack/react-query";
import { useCallback, useEffect, useRef, useState } from "react";
import { importBulk, onBulkProgress, type BulkImportResult, type BulkPart, type Progress } from "../../bridge/bulk";
import { invalidateCardData } from "../queries";

/**
 * Shared download/import state machine for Settings and the first-run onboarding:
 * subscribes to `bulk-progress`, runs `import_bulk`, and refreshes every card-derived query after.
 */

export type ImportRun =
  | { kind: "idle" }
  | { kind: "running"; progress: Progress | null; startedAt: number }
  | { kind: "done"; result: BulkImportResult }
  | { kind: "error"; message: string };

export const SCRYFALL_PARTS: BulkPart[] = ["oracle_cards", "printings", "rulings", "oracle_tags"];

export const STAGE_LABEL: Record<string, string> = {
  "download:scryfall/oracle_cards.jsonl.gz": "Downloading oracle cards",
  "download:scryfall/default_cards.jsonl.gz": "Downloading printings",
  "download:scryfall/rulings.jsonl.gz": "Downloading rulings",
  "download:scryfall/oracle_tags.jsonl.gz": "Downloading oracle tags",
  "download:spellbook/variants.json.gz": "Downloading Commander Spellbook combos",
  "import:oracle_cards": "Importing oracle cards",
  "import:printings": "Importing printings",
  "import:rulings": "Importing rulings",
  "import:oracle_tags": "Importing oracle tags",
  "import:spellbook": "Importing combos",
};

export function useBulkImport() {
  const queryClient = useQueryClient();
  const [run, setRun] = useState<ImportRun>({ kind: "idle" });
  const unlisten = useRef<(() => void) | null>(null);

  useEffect(() => {
    let alive = true;
    onBulkProgress((p) => {
      if (!alive) return;
      setRun((r) => (r.kind === "running" ? { ...r, progress: p } : r));
    })
      .then((fn) => {
        if (alive) unlisten.current = fn;
        else fn();
      })
      .catch((e: unknown) => console.error("bulk-progress listen failed", e));
    return () => {
      alive = false;
      unlisten.current?.();
    };
  }, []);

  const start = useCallback(
    async (source: "download" | "dir", withCombos: boolean): Promise<boolean> => {
      const parts: BulkPart[] = withCombos ? [...SCRYFALL_PARTS, "spellbook"] : SCRYFALL_PARTS;
      setRun({ kind: "running", progress: null, startedAt: Date.now() });
      try {
        const result = await importBulk(source === "download" ? { kind: "download" } : { kind: "dir" }, parts);
        setRun({ kind: "done", result });
        return true;
      } catch (e) {
        setRun({ kind: "error", message: e instanceof Error ? e.message : String(e) });
        return false;
      } finally {
        await invalidateCardData(queryClient);
      }
    },
    [queryClient],
  );

  const reset = useCallback(() => setRun({ kind: "idle" }), []);
  return { run, start, reset, busy: run.kind === "running" };
}

/** `navigator.onLine` as React state (WebView2 reports it reliably; offline banners and Spellbook fallbacks key off it). */
export function useOnline(): boolean {
  const [online, setOnline] = useState(() => (typeof navigator === "undefined" ? true : navigator.onLine));
  useEffect(() => {
    const up = () => setOnline(true);
    const down = () => setOnline(false);
    window.addEventListener("online", up);
    window.addEventListener("offline", down);
    return () => {
      window.removeEventListener("online", up);
      window.removeEventListener("offline", down);
    };
  }, []);
  return online;
}
