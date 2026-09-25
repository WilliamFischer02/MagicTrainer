import { useEffect, useState } from "react";
import { scryfallBulkIndex, type BulkEntry } from "../../bridge/bulk";
import { Button, Callout, Spinner, formatBytes } from "../components";
import { AlertIcon, CheckIcon, DatabaseIcon, DownloadIcon } from "../icons";
import { STAGE_LABEL, useBulkImport, useOnline } from "../hooks/useBulkImport";
import { useAppStore } from "../store";
import o from "./onboarding.module.css";

/**
 * First run (no card data yet): explain what will be downloaded and why, download Scryfall's bulk
 * files with progress, then hand off to Decks. Commander Spellbook's bulk stays opt-in (Q-013):
 * combos come from per-deck online lookups by default. Offline → a clear message, not a dead end.
 */

const SCRYFALL_TYPES = ["oracle_cards", "default_cards", "rulings", "oracle_tags"];

export function OnboardingScreen({ onSkip, onDone }: { onSkip: () => void; onDone: () => void }) {
  const { run, start, reset, busy } = useBulkImport();
  const online = useOnline();
  const [index, setIndex] = useState<BulkEntry[] | null>(null);
  const [indexError, setIndexError] = useState<string | null>(null);
  const navigate = useAppStore((st) => st.navigate);

  useEffect(() => {
    if (!online) return;
    scryfallBulkIndex()
      .then(setIndex)
      .catch((e: unknown) => setIndexError(e instanceof Error ? e.message : String(e)));
  }, [online]);

  const size = index ? index.filter((e) => SCRYFALL_TYPES.includes(e.type)).reduce((n, e) => n + (e.compressed_size ?? 0), 0) : 0;
  const updated = index?.find((e) => e.type === "oracle_cards")?.updated_at;

  const go = async () => {
    const ok = await start("download", false);
    if (ok) onDone();
  };

  return (
    <div className={o.wrap} role="dialog" aria-labelledby="mt-onboarding-title" aria-modal="true">
      <div className={o.panel}>
        <div className={o.glyph} aria-hidden="true">
          <DatabaseIcon />
        </div>
        <h1 id="mt-onboarding-title" className={o.title}>
          Welcome to MagicTrainer
        </h1>
        <p className={o.lede}>
          MagicTrainer works from a local copy of Scryfall's card database, so importing decks, showing card art and detecting strategies all work offline after a
          one-time download.
        </p>

        <ul className={o.list}>
          <li>
            <strong>Downloads now:</strong> Scryfall oracle cards, printings, rulings and community oracle tags —{" "}
            {index ? <strong>{formatBytes(size)}</strong> : indexError ? "about 110 MB" : "about 110 MB"}
            {updated ? ` (updated ${new Date(updated).toLocaleDateString()})` : ""}. Stored on this PC only.
          </li>
          <li>
            <strong>Not downloaded:</strong> Commander Spellbook's 600 MB combo database. Combos are looked up per deck online instead (you can turn that off in
            Settings, or import the bulk file later).
          </li>
          <li>
            <strong>Card images</strong> are fetched from Scryfall as you open decks and cached on disk.
          </li>
        </ul>

        {!online && (
          <Callout tone="warn" icon={<AlertIcon />}>
            You are offline. Connect to the internet to download the card data; you can also copy a `data` folder from another MagicTrainer install and use “Import from data
            folder” in Settings.
          </Callout>
        )}
        {indexError && online && (
          <Callout tone="warn" icon={<AlertIcon />}>
            Could not reach Scryfall to check sizes ({indexError}). You can still try the download.
          </Callout>
        )}

        {run.kind === "running" && (
          <div className={o.progress} role="status" aria-live="polite">
            <div className={o.progressLabel}>
              <span>
                {run.progress ? (STAGE_LABEL[run.progress.stage] ?? run.progress.stage) : "Starting…"}
                {run.progress?.message ? ` · ${run.progress.message}` : ""}
              </span>
              <span>{run.progress?.total ? `${Math.min(100, (run.progress.done / run.progress.total) * 100).toFixed(0)}%` : ""}</span>
            </div>
            <div className={o.bar}>
              {run.progress?.total ? <div className={o.barFill} style={{ width: `${Math.min(100, (run.progress.done / run.progress.total) * 100)}%` }} /> : <div className={`${o.barFill} ${o.barIndeterminate}`} />}
            </div>
            <p className={o.hint}>Takes about a minute on a fast connection. You can keep this window in the background.</p>
          </div>
        )}
        {run.kind === "error" && (
          <Callout tone="danger" icon={<AlertIcon />}>
            Download failed: {run.message}
            <div className={o.actions}>
              <Button size="sm" onClick={() => void go()}>
                Try again
              </Button>
              <Button size="sm" variant="ghost" onClick={reset}>
                Dismiss
              </Button>
            </div>
          </Callout>
        )}
        {run.kind === "done" && (
          <Callout tone="ok" icon={<CheckIcon />}>
            Card data ready ({run.result.seconds.toFixed(0)} s). Import your first deck.
          </Callout>
        )}

        <div className={o.actions}>
          <Button variant="primary" onClick={() => void go()} disabled={busy || !online}>
            {busy ? <Spinner /> : <DownloadIcon />} {busy ? "Downloading…" : "Download card data"}
          </Button>
          <Button
            variant="ghost"
            onClick={() => {
              navigate("settings");
              onSkip();
            }}
            disabled={busy}
          >
            Not now — open Settings
          </Button>
        </div>
        <p className={o.credit}>
          Card data and images © Wizards of the Coast, provided by Scryfall. MagicTrainer is unofficial Fan Content permitted under the Fan Content Policy.
        </p>
      </div>
    </div>
  );
}
