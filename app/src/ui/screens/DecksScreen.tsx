import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { onFileDrop, pickImportFiles, readImportFile, saveTextFile } from "../../bridge/decks";
import { EXPORT_DIALECTS, exportDecklist, exportFileName, type ExportDialect } from "../../core/export/decklist";
import { FORMATS, deckWarnings, importDeck, type ImportedDeck } from "../../core/import/deckImport";
import { countCards } from "../../core/parsers/decklist";
import type { Candidate, NameIndex, Resolution } from "../../core/resolve/resolver";
import type { Deck, DeckEntry, Format } from "../../core/types";
import { resolveDeckNames, type DeckResolution, type DeckSummary } from "../../data";
import { Button, Callout, Card, EmptyState, Page, Spinner, formatCount, formatDate } from "../components";
import { AlertIcon, ArrowLeftIcon, CheckIcon, ClipboardIcon, CopyIcon, DeckIcon, DownloadIcon, FolderIcon, ImportIcon, SearchIcon, TrashIcon } from "../icons";
import { cardImageSrc } from "../../bridge/images";
import type { Color } from "../../core/types";
import { useCard, useCardSearch, useDbStatus, useDeck, useDecks, useDeleteDeck, useNameIndex, usePrefetchImages, useSaveDeck } from "../queries";
import { useAppStore } from "../store";
import { DeckAnalysis } from "./DeckAnalysis";
import d from "./decks.module.css";
import s from "./screens.module.css";

/**
 * Decks: library (saved decks) + detail, and the import flow
 * file / drop / paste → parse (`core/import`) → resolve (`core/resolve` via NameIndex) → fixer → save (Rust).
 * Dev: `?route=decks&importFile=<path>` opens the review screen for that file; `?deck=<id>` selects a deck.
 */

type Draft = { imported: ImportedDeck; sourceLabel: string };

export function DecksScreen() {
  const mode = useAppStore((st) => st.mode);
  const [draft, setDraft] = useState<Draft | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [reading, setReading] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  // Warm the resolver index as soon as the screen opens so the review step is instant.
  useNameIndex();

  const openPaths = useCallback(async (paths: string[]) => {
    const path = paths[0];
    if (!path) return;
    setReading(true);
    setLoadError(null);
    try {
      const file = await readImportFile(path);
      const imported = importDeck(file.text, { fileName: file.fileName });
      const extra = paths.length > 1 ? ` (${paths.length - 1} more file${paths.length > 2 ? "s" : ""} ignored — import one deck at a time)` : "";
      setDraft({ imported, sourceLabel: `${file.fileName}${extra}` });
    } catch (e) {
      setLoadError(e instanceof Error ? e.message : String(e));
    } finally {
      setReading(false);
    }
  }, []);

  useEffect(() => {
    let unlisten: (() => void) | null = null;
    let alive = true;
    onFileDrop((st) => {
      if (st.kind === "over") setDragOver(true);
      else if (st.kind === "leave") setDragOver(false);
      else {
        setDragOver(false);
        void openPaths(st.paths);
      }
    })
      .then((fn) => {
        if (alive) unlisten = fn;
        else fn();
      })
      .catch((e: unknown) => console.error("drag-drop listen failed", e));
    const dev = new URLSearchParams(globalThis.location?.search ?? "").get("importFile");
    if (dev) void openPaths([dev]);
    return () => {
      alive = false;
      unlisten?.();
    };
  }, [openPaths]);

  const pick = async () => {
    try {
      const paths = await pickImportFiles();
      await openPaths(paths);
    } catch (e) {
      setLoadError(e instanceof Error ? e.message : String(e));
    }
  };

  const pasteText = (text: string) => {
    setLoadError(null);
    setDraft({ imported: importDeck(text), sourceLabel: "pasted text" });
  };

  if (draft) {
    return <ImportReview draft={draft} onCancel={() => setDraft(null)} onSaved={() => setDraft(null)} />;
  }

  return (
    <Page
      title="Decks"
      subtitle={mode === "builder" ? "Import a list, fix any unknown names, then analyze curve, mana, roles, and strategies." : "Pick a deck and watch its winning lines play out against an opponent track."}
      actions={
        <Button variant="primary" onClick={() => void pick()} disabled={reading}>
          <ImportIcon /> Import deck…
        </Button>
      }
    >
      {dragOver && <div className={d.dropOverlay}>Drop to import</div>}
      <Library onPick={() => void pick()} onPaste={pasteText} reading={reading} loadError={loadError} dragOver={dragOver} />
    </Page>
  );
}

// ---- library + detail -----------------------------------------------------------------

function Library({ onPick, onPaste, reading, loadError, dragOver }: { onPick: () => void; onPaste: (text: string) => void; reading: boolean; loadError: string | null; dragOver: boolean }) {
  const decks = useDecks();
  const { selectedDeckId, selectDeck } = useAppStore();
  const [showPaste, setShowPaste] = useState(false);
  const [paste, setPaste] = useState("");
  const list = decks.data ?? [];

  useEffect(() => {
    if (!decks.data) return;
    if (selectedDeckId && !decks.data.some((x) => x.id === selectedDeckId)) selectDeck(decks.data[0]?.id ?? null);
    if (!selectedDeckId && decks.data[0]) selectDeck(decks.data[0].id);
  }, [decks.data, selectedDeckId, selectDeck]);

  const importPanel = (
    <>
      <div className={`${d.dropZone} ${dragOver ? d.dropZoneActive : ""}`}>
        <ImportIcon />
        <div>
          <strong>Drop a decklist here</strong>
          <div className={d.muted}>Moxfield / Archidekt / Arena / MTGO text · ManaBox, TCGplayer, Moxfield CSV</div>
        </div>
        <div className={d.row}>
          <Button size="sm" onClick={onPick} disabled={reading}>
            <FolderIcon /> Choose file
          </Button>
          <Button size="sm" variant="ghost" onClick={() => setShowPaste((v) => !v)} aria-expanded={showPaste}>
            <ClipboardIcon /> Paste a list
          </Button>
        </div>
        <div role="status" aria-live="polite">
          {reading && (
            <div className={s.state} style={{ marginTop: 0 }}>
              <Spinner /> Reading file…
            </div>
          )}
        </div>
      </div>
      {showPaste && (
        <div className={d.library}>
          <textarea
            className={d.pasteBox}
            value={paste}
            onChange={(e) => setPaste(e.target.value)}
            placeholder={"Commander\n1 Athreos, God of Passage\n\nDeck\n1 Blood Artist\n1 Zulaport Cutthroat\n…"}
            aria-label="Paste a decklist"
            spellCheck={false}
          />
          <div className={`${d.row} ${d.rowEnd}`}>
            <Button size="sm" variant="ghost" onClick={() => setShowPaste(false)}>
              Cancel
            </Button>
            <Button size="sm" variant="primary" disabled={!paste.trim()} onClick={() => onPaste(paste)}>
              Review list
            </Button>
          </div>
        </div>
      )}
      {loadError && (
        <Callout tone="danger" icon={<AlertIcon />}>
          Could not read that file: {loadError}
        </Callout>
      )}
    </>
  );

  if (decks.isPending) {
    return (
      <div className={s.state} role="status">
        <Spinner /> Loading your decks…
      </div>
    );
  }
  if (decks.error) {
    return (
      <Callout tone="danger" icon={<AlertIcon />}>
        Could not load decks: {decks.error instanceof Error ? decks.error.message : String(decks.error)}
      </Callout>
    );
  }

  if (list.length === 0) {
    return (
      <div className={d.split}>
        <div className={d.library}>{importPanel}</div>
        <EmptyState
          icon={<DeckIcon />}
          title="No decks yet"
          body="Import your first list — the six sample decks live in data/samples/decks. Unknown card names get a fixer with suggestions before anything is saved."
        />
      </div>
    );
  }

  return (
    <div className={d.split}>
      <div className={d.library}>
        {importPanel}
        <div className={d.libraryList} role="group" aria-label="Saved decks">
          {list.map((deck) => (
            <button key={deck.id} type="button" aria-pressed={deck.id === selectedDeckId} className={d.deckCard} onClick={() => selectDeck(deck.id)}>
              <span className={d.deckCardTop}>
                <Identity colors={deck.colors} />
                <span className={d.deckName}>{deck.name}</span>
              </span>
              <span className={d.chip}>{deck.format ?? "no format"}</span>
              <span className={d.deckSub}>
                {deck.commanders.length ? `${deck.commanders.join(" / ")} · ` : ""}
                {formatCount(deck.mainCount)} cards
                {deck.unresolved > 0 ? ` · ${deck.unresolved} unresolved` : ""} · {formatDate(deck.updatedAt)}
              </span>
            </button>
          ))}
        </div>
      </div>
      {selectedDeckId ? <DeckDetail id={selectedDeckId} summary={list.find((x) => x.id === selectedDeckId)} /> : <div />}
    </div>
  );
}

function DeckDetail({ id, summary }: { id: string; summary: DeckSummary | undefined }) {
  const deck = useDeck(id);
  const del = useDeleteDeck();
  const selectDeck = useAppStore((st) => st.selectDeck);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [showList, setShowList] = useState(false);
  useEffect(() => setConfirmDelete(false), [id]);
  const commanderId = deck.data?.commanders[0]?.oracleId;
  const commander = useCard(commanderId);
  const prefetch = usePrefetchImages();
  const prefetched = useRef<string | null>(null);
  useEffect(() => {
    // Warm the image cache for this deck once per open (art crops first; the board uses them).
    const dk = deck.data;
    if (!dk || prefetched.current === id) return;
    prefetched.current = id;
    const art = summary?.commanderArt ? [summary.commanderArt] : [];
    prefetch.mutate(art);
  }, [deck.data, id, summary?.commanderArt, prefetch]);

  if (deck.isPending) {
    return (
      <div className={s.state} role="status">
        <Spinner /> Opening deck…
      </div>
    );
  }
  if (deck.error || !deck.data) {
    return (
      <Callout tone="danger" icon={<AlertIcon />}>
        Could not open this deck{deck.error ? `: ${deck.error instanceof Error ? deck.error.message : String(deck.error)}` : ""}.
      </Callout>
    );
  }
  const dk = deck.data;
  const sections: { key: string; label: string; entries: DeckEntry[] }[] = [
    { key: "commanders", label: "Commander", entries: dk.commanders },
    { key: "main", label: "Main deck", entries: dk.main },
    { key: "sideboard", label: "Sideboard", entries: dk.sideboard },
    ...Object.entries(dk.extra).map(([k, v]) => ({ key: `extra:${k}`, label: k.charAt(0).toUpperCase() + k.slice(1), entries: v })),
  ].filter((x) => x.entries.length > 0);
  const unresolved = [...dk.commanders, ...dk.main].filter((e) => !e.oracleId).length;

  const art = cardImageSrc(commander.data?.imageUris?.art_crop ?? summary?.commanderArt);
  const identity = summary?.colors ?? [];

  return (
    <div className={d.detail}>
      <div className={d.hero}>
        {art && <div className={d.heroArt} style={{ backgroundImage: `url("${art}")` }} aria-hidden="true" />}
        {art ? (
          <img className={d.heroThumb} src={art} alt={commander.data ? `${commander.data.name} art` : ""} width={96} height={72} decoding="async" />
        ) : (
          <div className={d.heroThumbEmpty} aria-hidden="true">
            <DeckIcon />
          </div>
        )}
        <div className={d.heroBody}>
          <h2 className={d.detailTitle}>
            {identity.length > 0 && <Identity colors={identity} />} {dk.name}
          </h2>
          <div className={d.detailMeta}>
            <span className={d.chip}>{dk.format ?? "no format"}</span>
            <span>{formatCount(countCards(dk.main) + countCards(dk.commanders))} cards</span>
            <span>· imported from {dk.source.format.replace("-", " ")}</span>
            <span>· updated {formatDate(dk.updatedAt)}</span>
            {unresolved > 0 && <span className={`${d.chip} ${d.chipWarn}`}>{unresolved} unresolved</span>}
            {summary && unresolved === 0 && <span className={`${d.chip} ${d.chipOk}`}>all cards resolved</span>}
          </div>
        <div className={`${d.row} ${d.heroActions}`}>
          <ExportControls deck={dk} />
          {confirmDelete ? (
            <>
              <span className={d.muted}>Delete “{dk.name}”?</span>
              <Button size="sm" variant="ghost" onClick={() => setConfirmDelete(false)}>
                Keep
              </Button>
              <Button
                size="sm"
                onClick={() =>
                  del.mutate(id, {
                    onSuccess: () => selectDeck(null),
                  })
                }
                disabled={del.isPending}
              >
                <TrashIcon /> Delete
              </Button>
            </>
          ) : (
            <Button size="sm" variant="ghost" onClick={() => setConfirmDelete(true)}>
              <TrashIcon /> Delete
            </Button>
          )}
        </div>
        </div>
      </div>
      {del.isError && (
        <Callout tone="danger" icon={<AlertIcon />}>
          Could not delete: {del.error instanceof Error ? del.error.message : String(del.error)}
        </Callout>
      )}
      <DeckAnalysis deck={dk} />
      <Button size="sm" variant="ghost" className={d.entriesToggle} onClick={() => setShowList((v) => !v)} aria-expanded={showList}>
        {showList ? "Hide decklist" : "Show decklist"}
      </Button>
      {showList && sections.length === 0 && <p className={d.emptyDeckNote}>No cards were saved for this deck — every line was skipped. Re-import the list to try again.</p>}
      {showList && sections.length > 0 && (
      <div className={d.sections}>
        {sections.map((sec) => (
          <Card key={sec.key}>
            <h3 className={d.sectionTitle}>
              <span>{sec.label}</span>
              <span>{countCards(sec.entries)}</span>
            </h3>
            <ul className={d.entryList}>
              {sec.entries.map((e, i) => (
                <li key={`${e.name}-${i}`} className={d.entry}>
                  <span className={d.entryQty}>{e.quantity}</span>
                  <span className={`${d.entryName} ${e.oracleId ? "" : d.entryUnresolved}`} title={e.oracleId ? e.name : `${e.name} — not matched to a card`}>
                    {e.name}
                  </span>
                  <span className={d.muted}>{e.setCode?.toUpperCase() ?? ""}</span>
                </li>
              ))}
            </ul>
          </Card>
        ))}
      </div>
      )}
    </div>
  );
}

type ExportStatus = { kind: "idle" } | { kind: "ok"; message: string } | { kind: "error"; message: string };

/** Copy (Moxfield / Arena / MTGO dialect) or save the decklist as text. Status is announced inline, never in a dialog. */
function ExportControls({ deck }: { deck: Deck }) {
  const [dialect, setDialect] = useState<ExportDialect>("moxfield");
  const [status, setStatus] = useState<ExportStatus>({ kind: "idle" });
  useEffect(() => {
    if (status.kind === "idle") return;
    const t = setTimeout(() => setStatus({ kind: "idle" }), 4000);
    return () => clearTimeout(t);
  }, [status]);
  const text = () => exportDecklist(deck, dialect);
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(text());
      setStatus({ kind: "ok", message: "Copied" });
    } catch (e) {
      setStatus({ kind: "error", message: `Copy failed: ${e instanceof Error ? e.message : String(e)}` });
    }
  };
  const saveAs = async () => {
    try {
      const path = await saveTextFile(exportFileName(deck.name, dialect), text());
      setStatus(path ? { kind: "ok", message: `Saved ${path.replace(/^.*[\\/]/, "")}` } : { kind: "idle" });
    } catch (e) {
      setStatus({ kind: "error", message: `Save failed: ${e instanceof Error ? e.message : String(e)}` });
    }
  };
  return (
    <div className={d.exportRow}>
      <label className={d.srOnlyLabel}>
        <span className="sr-only">Export dialect</span>
        <select className={`${d.select} ${d.selectSm}`} value={dialect} onChange={(e) => setDialect(e.target.value as ExportDialect)} title={EXPORT_DIALECTS.find((x) => x.id === dialect)?.hint}>
          {EXPORT_DIALECTS.map((x) => (
            <option key={x.id} value={x.id}>
              {x.label}
            </option>
          ))}
        </select>
      </label>
      <Button size="sm" variant="ghost" onClick={() => void copy()} title="Copy the decklist to the clipboard">
        <CopyIcon /> Copy
      </Button>
      <Button size="sm" variant="ghost" onClick={() => void saveAs()} title="Save the decklist as a .txt file">
        <DownloadIcon /> Save…
      </Button>
      <span className={`${d.exportStatus} ${status.kind === "error" ? d.exportStatusError : ""}`} role="status" aria-live="polite">
        {status.kind === "idle" ? "" : status.message}
      </span>
    </div>
  );
}

const COLOR_WORD: Record<Color, string> = { W: "white", U: "blue", B: "black", R: "red", G: "green" };

/** Color identity as small mana badges; the letters are the identity, not the hue. */
function Identity({ colors }: { colors: readonly Color[] }) {
  if (colors.length === 0) return null;
  return (
    <span className={d.identity} role="img" aria-label={`Color identity: ${colors.map((c) => COLOR_WORD[c]).join(", ")}`}>
      {colors.map((c) => (
        <span key={c} className={`${d.manaBadge} ${d[`mana${c}`]}`} aria-hidden="true">
          {c}
        </span>
      ))}
    </span>
  );
}

// ---- import review -------------------------------------------------------------------

type Override = { oracleId: string; name: string } | "skip";

function ImportReview({ draft, onCancel, onSaved }: { draft: Draft; onCancel: () => void; onSaved: (id: string) => void }) {
  const { imported, sourceLabel } = draft;
  const [name, setName] = useState(imported.deck.name);
  const [format, setFormat] = useState<Format | "">(imported.deck.format ?? "");
  const [overrides, setOverrides] = useState<Record<string, Override>>({});
  const index = useNameIndex();
  const db = useDbStatus();
  const save = useSaveDeck();
  const selectDeck = useAppStore((st) => st.selectDeck);
  const nameRef = useRef<HTMLInputElement>(null);
  const [confirmBack, setConfirmBack] = useState(false);
  useEffect(() => nameRef.current?.focus(), []);
  const dirty = Object.keys(overrides).length > 0;
  const back = () => {
    if (dirty && !confirmBack) setConfirmBack(true);
    else onCancel();
  };

  const deckForResolve = useMemo<Deck>(() => ({ ...imported.deck, name: name.trim() || imported.deck.name, format: format || undefined }), [imported.deck, name, format]);
  const resolution: DeckResolution | null = useMemo(() => (index.data ? resolveDeckNames(index.data, deckForResolve) : null), [index.data, deckForResolve]);

  const needsAttention = useMemo(() => {
    if (!resolution) return [];
    return resolution.resolutions.filter((r) => !r.oracleId || r.method === "fuzzy");
  }, [resolution]);

  const finalDeck = useMemo<Deck | null>(() => {
    if (!resolution) return null;
    const byInput = new Map(resolution.resolutions.map((r) => [r.input, r]));
    const apply = (e: DeckEntry): DeckEntry => {
      const ov = overrides[e.name];
      if (ov === "skip") return { ...e, oracleId: undefined };
      if (ov) return { ...e, name: ov.name, oracleId: ov.oracleId };
      const r = byInput.get(e.name);
      if (r?.oracleId && r.name) return { ...e, name: r.name, oracleId: r.oracleId };
      return { ...e, oracleId: undefined };
    };
    return {
      ...deckForResolve,
      commanders: deckForResolve.commanders.map(apply),
      main: deckForResolve.main.map(apply),
      sideboard: deckForResolve.sideboard.map(apply),
      extra: Object.fromEntries(Object.entries(deckForResolve.extra).map(([k, v]) => [k, v.map(apply)])),
    };
  }, [resolution, overrides, deckForResolve]);

  const stillUnresolved = finalDeck ? [...finalDeck.commanders, ...finalDeck.main].filter((e) => !e.oracleId).length : 0;
  const total = countCards(imported.deck.main) + countCards(imported.deck.commanders);
  const noData = db.data && (db.data.counts.cards ?? 0) === 0;

  const onSave = () => {
    if (!finalDeck) return;
    save.mutate(finalDeck, {
      onSuccess: () => {
        selectDeck(finalDeck.id);
        onSaved(finalDeck.id);
      },
    });
  };

  return (
    <Page
      title="Review import"
      subtitle={`From ${sourceLabel}. Nothing is saved until you confirm.`}
      actions={
        <div className={d.row}>
          {confirmBack && <span className={d.muted}>Discard your name fixes?</span>}
          <Button variant="ghost" onClick={back}>
            <ArrowLeftIcon /> {confirmBack ? "Discard & go back" : "Back"}
          </Button>
          {confirmBack && (
            <Button variant="ghost" onClick={() => setConfirmBack(false)}>
              Stay
            </Button>
          )}
          <Button variant="primary" onClick={onSave} disabled={!finalDeck || save.isPending || total === 0 || !name.trim()}>
            {save.isPending ? <Spinner /> : <CheckIcon />} Save deck
          </Button>
        </div>
      }
    >
      <div className={d.review}>
        <div className={d.reviewMain}>
          <Card>
            <div className={d.fields}>
              <label className={d.field}>
                <span className={d.label}>Deck name</span>
                <input ref={nameRef} className={d.input} value={name} onChange={(e) => setName(e.target.value)} maxLength={120} aria-invalid={!name.trim()} />
              </label>
              <label className={d.field}>
                <span className={d.label}>Format</span>
                <select className={d.select} value={format} onChange={(e) => setFormat(e.target.value as Format | "")}>
                  <option value="">Not set</option>
                  {FORMATS.map((f) => (
                    <option key={f} value={f}>
                      {f.charAt(0).toUpperCase() + f.slice(1)}
                    </option>
                  ))}
                </select>
              </label>
            </div>
            <div className={d.counts} style={{ marginTop: "var(--s-4)" }}>
              <Count value={countCards(imported.deck.commanders)} label="commander" />
              <Count value={countCards(imported.deck.main)} label="main deck" />
              <Count value={countCards(imported.deck.sideboard)} label="sideboard" />
              {Object.entries(imported.deck.extra).map(([k, v]) => (
                <Count key={k} value={countCards(v)} label={k} />
              ))}
              <Count value={resolution ? resolution.resolutions.length - needsAttention.length : null} label="names matched" />
              <Count value={resolution ? stillUnresolved : null} label="unresolved" tone={stillUnresolved > 0 ? "warn" : "ok"} />
            </div>
          </Card>

          {imported.errors.length > 0 && (
            <Callout tone="danger" icon={<AlertIcon />}>
              {imported.errors.length} row{imported.errors.length === 1 ? "" : "s"} could not be read:
              <ul className={d.list}>
                {imported.errors.slice(0, 8).map((e, i) => (
                  <li key={i}>{e}</li>
                ))}
                {imported.errors.length > 8 && <li>…and {imported.errors.length - 8} more</li>}
              </ul>
            </Callout>
          )}
          {deckWarnings(finalDeck ?? deckForResolve).map((w) => (
            <Callout key={w} tone="warn" icon={<AlertIcon />}>
              {w}
            </Callout>
          ))}
          {noData && (
            <Callout tone="warn" icon={<AlertIcon />}>
              The card database is empty, so names cannot be matched yet. You can still save this list; download card data in Settings and re-import to resolve it.
            </Callout>
          )}

          <Card title={needsAttention.length ? `Check ${needsAttention.length} name${needsAttention.length === 1 ? "" : "s"}` : "All names matched"}>
            {index.isPending && (
              <div className={s.state} role="status" style={{ marginTop: 0 }}>
                <Spinner /> Loading the card index…
              </div>
            )}
            {index.error && (
              <Callout tone="danger" icon={<AlertIcon />}>
                Could not load the card index: {index.error instanceof Error ? index.error.message : String(index.error)}
              </Callout>
            )}
            {resolution && needsAttention.length === 0 && (
              <p className={d.resolvedNote}>
                <CheckIcon /> Every card name matched a Scryfall card exactly.
              </p>
            )}
            {resolution && needsAttention.length > 0 && (
              <div className={d.fixerList}>
                <p className={d.muted} style={{ margin: 0 }}>
                  Pick the right card for each name, or skip it to save the line as-is (it will be flagged and excluded from analysis).
                </p>
                {needsAttention.map((r) => (
                  <FixerRow key={r.input} resolution={r} override={overrides[r.input]} onChoose={(ov) => setOverrides((o) => ({ ...o, [r.input]: ov }))} index={index.data ?? null} />
                ))}
              </div>
            )}
          </Card>
        </div>

        <aside className={d.reviewSide} aria-label="Import summary">
          <Card title="What happens on save">
            <ul className={d.list}>
              <li>The list is stored locally with your name and format.</li>
              <li>Matched names are saved with their Scryfall card, so images, prices, and strategy detection work.</li>
              <li>Unresolved lines are kept but flagged; fix them any time by re-importing.</li>
              <li>The original text is kept for export.</li>
            </ul>
          </Card>
          {save.isError && (
            <Callout tone="danger" icon={<AlertIcon />}>
              Save failed: {save.error instanceof Error ? save.error.message : String(save.error)}
            </Callout>
          )}
        </aside>
      </div>
    </Page>
  );
}

function Count({ value, label, tone }: { value: number | null; label: string; tone?: "warn" | "ok" }) {
  return (
    <div className={d.count}>
      <span className={d.countVal} style={tone === "warn" && value ? { color: "var(--warn)" } : tone === "ok" && value === 0 ? { color: "var(--ok)" } : undefined}>
        {value === null ? "…" : formatCount(value)}
      </span>
      <span className={d.countKey}>{label}</span>
    </div>
  );
}

function FixerRow({ resolution, override, onChoose, index }: { resolution: Resolution; override: Override | undefined; onChoose: (ov: Override) => void; index: NameIndex | null }) {
  const [query, setQuery] = useState("");
  const search = useCardSearch(query, 8);
  const chosenId = override && override !== "skip" ? override.oracleId : undefined;
  const fuzzyAccepted = resolution.method === "fuzzy" && resolution.oracleId;
  const candidates: Candidate[] = useMemo(() => {
    const base = [...resolution.candidates];
    if (fuzzyAccepted && !base.some((c) => c.oracleId === resolution.oracleId)) base.unshift({ oracleId: resolution.oracleId!, name: resolution.name!, score: resolution.confidence });
    return base.slice(0, 5);
  }, [resolution, fuzzyAccepted]);
  const searchHits = (search.data ?? []).filter((h) => !candidates.some((c) => c.oracleId === h.oracleId));
  const effectiveId = chosenId ?? (override === "skip" ? undefined : fuzzyAccepted ? resolution.oracleId : undefined);

  return (
    <div className={d.fixer}>
      <div className={d.fixerHead}>
        <span className={d.fixerInput}>{resolution.input}</span>
        <span className={d.fixerHint}>
          {override === "skip" ? "skipped" : effectiveId ? `→ ${override ? override.name : resolution.name}` : fuzzyAccepted ? "fuzzy match — confirm" : "no match"}
        </span>
      </div>
      <div className={d.candidates}>
        {candidates.map((c) => (
          <button key={c.oracleId} type="button" className={d.candidate} aria-pressed={effectiveId === c.oracleId} onClick={() => onChoose({ oracleId: c.oracleId, name: c.name })}>
            {c.name}
            <span className={d.candidateScore}>{Math.round(c.score * 100)}%</span>
          </button>
        ))}
        {searchHits.map((h) => (
          <button key={h.oracleId} type="button" className={d.candidate} aria-pressed={effectiveId === h.oracleId} onClick={() => onChoose({ oracleId: h.oracleId, name: h.name })}>
            {h.name}
          </button>
        ))}
        <button type="button" className={d.candidate} aria-pressed={override === "skip"} onClick={() => onChoose("skip")}>
          Skip
        </button>
      </div>
      <div className={d.fixerSearch}>
        <SearchIcon />
        <input type="search" value={query} onChange={(e) => setQuery(e.target.value)} placeholder={index ? "Search all cards…" : "Card index not loaded"} aria-label={`Search a card for ${resolution.input}`} disabled={!index} autoComplete="off" spellCheck={false} />
      </div>
    </div>
  );
}
