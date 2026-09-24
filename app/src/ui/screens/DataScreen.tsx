import { useEffect, useRef, useState } from "react";
import { importBulk, onBulkProgress, type BulkImportResult, type BulkPart, type Progress } from "../../bridge/bulk";
import { Button, Callout, Card, EmptyState, ExternalLink, Page, Spinner, formatBytes, formatCount, formatDate } from "../components";
import { AlertIcon, CheckIcon, DatabaseIcon, DownloadIcon, FolderIcon } from "../icons";
import { useAppStore } from "../store";
import s from "./screens.module.css";

type Run = { kind: "idle" } | { kind: "running"; progress: Progress | null; startedAt: number } | { kind: "done"; result: BulkImportResult } | { kind: "error"; message: string };

const STAGE_LABEL: Record<string, string> = {
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

const SCRYFALL_PARTS: BulkPart[] = ["oracle_cards", "printings", "rulings", "oracle_tags"];

export function DataScreen() {
  const { db, dbError, refreshDb } = useAppStore();
  const [run, setRun] = useState<Run>({ kind: "idle" });
  const [withCombos, setWithCombos] = useState(false);
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

  const start = async (source: "download" | "dir") => {
    const parts: BulkPart[] = withCombos ? [...SCRYFALL_PARTS, "spellbook"] : SCRYFALL_PARTS;
    setRun({ kind: "running", progress: null, startedAt: Date.now() });
    try {
      const result = await importBulk(source === "download" ? { kind: "download" } : { kind: "dir" }, parts);
      setRun({ kind: "done", result });
    } catch (e) {
      setRun({ kind: "error", message: e instanceof Error ? e.message : String(e) });
    } finally {
      await refreshDb();
    }
  };

  const busy = run.kind === "running";
  const hasData = !!db?.exists && (db.counts.cards ?? 0) > 0;

  return (
    <Page title="Settings" subtitle="Card data lives on this PC. Download once, then everything works offline.">
      <div className={s.stack}>
        <Card title="Card database">
          {dbError && (
            <Callout tone="danger" icon={<AlertIcon />}>
              Could not read the database status: {dbError}
            </Callout>
          )}
          {!dbError && !db && (
            <div className={s.state} role="status">
              <Spinner /> Reading database status…
            </div>
          )}
          {db && !hasData && run.kind !== "running" && run.kind !== "done" && (
            <EmptyState
              icon={<DatabaseIcon />}
              title="No card data yet"
              body="MagicTrainer needs Scryfall's card database (about 110 MB) to resolve your decklists, show images, and detect strategies. Download it once; updates are optional."
              actions={
                <Button variant="primary" onClick={() => void start("download")} disabled={busy}>
                  <DownloadIcon /> Download &amp; import
                </Button>
              }
            />
          )}
          {db && hasData && (
            <div className={s.grid2}>
              <div>
                <div className={s.statRow}>
                  <span className={s.statKey}>Oracle cards</span>
                  <span className={s.statVal}>{formatCount(db.counts.cards ?? 0)}</span>
                </div>
                <div className={s.statRow}>
                  <span className={s.statKey}>Printings</span>
                  <span className={s.statVal}>{formatCount(db.counts.printings ?? 0)}</span>
                </div>
                <div className={s.statRow}>
                  <span className={s.statKey}>Rulings</span>
                  <span className={s.statVal}>{formatCount(db.counts.rulings ?? 0)}</span>
                </div>
                <div className={s.statRow}>
                  <span className={s.statKey}>Oracle tags · taggings</span>
                  <span className={s.statVal}>
                    {formatCount(db.counts.oracle_tags ?? 0)} · {formatCount(db.counts.card_oracle_tags ?? 0)}
                  </span>
                </div>
                <div className={s.statRow}>
                  <span className={s.statKey}>Spellbook combos</span>
                  <span className={s.statVal}>{formatCount(db.counts.spellbook_variants ?? 0)}</span>
                </div>
              </div>
              <div>
                <div className={s.statRow}>
                  <span className={s.statKey}>Cards imported</span>
                  <span className={s.statVal}>{formatDate(db.meta["imported.oracle_cards"])}</span>
                </div>
                <div className={s.statRow}>
                  <span className={s.statKey}>Combos imported</span>
                  <span className={s.statVal}>{formatDate(db.meta["imported.spellbook"])}</span>
                </div>
                <div className={s.statRow}>
                  <span className={s.statKey}>Spellbook data as of</span>
                  <span className={s.statVal}>{formatDate(db.meta["spellbook.timestamp"])}</span>
                </div>
                <div className={s.statRow}>
                  <span className={s.statKey}>Schema</span>
                  <span className={s.statVal}>v{db.schemaVersion ?? "?"}</span>
                </div>
              </div>
            </div>
          )}
          {db && (
            <>
              <label className={s.check}>
                <input type="checkbox" checked={withCombos} onChange={(e) => setWithCombos(e.target.checked)} disabled={busy} />
                Include Commander Spellbook combos (large download, several hundred MB — optional)
              </label>
              <div className={s.actions}>
                <Button variant={hasData ? "default" : "primary"} onClick={() => void start("download")} disabled={busy}>
                  <DownloadIcon /> {hasData ? "Update from Scryfall" : "Download & import"}
                </Button>
                <Button variant="ghost" onClick={() => void start("dir")} disabled={busy} title={`Import files already in ${db.dataDir}`}>
                  <FolderIcon /> Import from data folder
                </Button>
              </div>
              <p className={s.path} style={{ marginTop: "var(--s-3)" }}>
                {db.dbPath}
              </p>
            </>
          )}

          {run.kind === "running" && <ProgressView progress={run.progress} startedAt={run.startedAt} />}
          {run.kind === "done" && <ReportView result={run.result} />}
          {run.kind === "error" && (
            <div style={{ marginTop: "var(--s-4)" }}>
              <Callout tone="danger" icon={<AlertIcon />}>
                Import failed: {run.message}
                <div className={s.actions}>
                  <Button size="sm" onClick={() => void start("download")}>
                    Retry download
                  </Button>
                  <Button size="sm" variant="ghost" onClick={() => setRun({ kind: "idle" })}>
                    Dismiss
                  </Button>
                </div>
              </Callout>
            </div>
          )}
        </Card>

        <Card title="Sources & credits">
          <p style={{ color: "var(--ink-2)", fontSize: "var(--fs-2)" }}>
            Card data and images © Wizards of the Coast, provided by <ExternalLink href="https://scryfall.com">Scryfall</ExternalLink> (oracle text, rulings, community oracle
            tags from Tagger). Combos from <ExternalLink href="https://commanderspellbook.com">Commander Spellbook</ExternalLink>. Comprehensive Rules © Wizards of the Coast.
            MagicTrainer is unofficial Fan Content permitted under the Fan Content Policy.
          </p>
        </Card>
      </div>
    </Page>
  );
}

function ProgressView({ progress, startedAt }: { progress: Progress | null; startedAt: number }) {
  const label = progress ? (STAGE_LABEL[progress.stage] ?? progress.stage) : "Starting…";
  const pct = progress && progress.total ? Math.min(100, (progress.done / progress.total) * 100) : null;
  const elapsed = Math.round((Date.now() - startedAt) / 1000);
  return (
    <div className={s.progress} role="status" aria-live="polite">
      <div className={s.progressLabel}>
        <span>
          {label}
          {progress?.message ? ` · ${progress.message}` : ""}
        </span>
        <span>
          {pct !== null ? `${pct.toFixed(0)}%` : ""} · {elapsed}s
        </span>
      </div>
      <div className={s.bar}>
        {pct !== null ? <div className={s.barFill} style={{ width: `${pct}%` }} /> : <div className={`${s.barFill} ${s.barIndeterminate}`} />}
      </div>
    </div>
  );
}

function ReportView({ result }: { result: BulkImportResult }) {
  const downloadedBytes = result.downloaded.reduce((n, d) => n + d.bytes, 0);
  return (
    <div style={{ marginTop: "var(--s-4)" }}>
      <Callout tone="ok" icon={<CheckIcon />}>
        Import finished in {result.seconds.toFixed(0)} s{downloadedBytes > 0 ? ` (downloaded ${formatBytes(downloadedBytes)})` : ""}.
        <table className={s.reportTable}>
          <thead>
            <tr>
              <th>Dataset</th>
              <th style={{ textAlign: "right" }}>Rows</th>
              <th style={{ textAlign: "right" }}>Ignored</th>
              <th style={{ textAlign: "right" }}>Seconds</th>
            </tr>
          </thead>
          <tbody>
            {result.report.parts.map((p) => (
              <tr key={p.part}>
                <td>
                  {p.part}
                  {p.skipped ? ` — skipped: ${p.skipped}` : ""}
                </td>
                <td className={s.num}>{p.skipped ? "" : formatCount(p.rows)}</td>
                <td className={s.num}>{p.skipped ? "" : formatCount(p.ignored)}</td>
                <td className={s.num}>{p.skipped ? "" : p.seconds.toFixed(1)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </Callout>
    </div>
  );
}
