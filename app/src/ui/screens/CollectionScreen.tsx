import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { onFileDrop, pickImportFiles, readImportFile } from "../../bridge/decks";
import { cardImageSrc } from "../../bridge/images";
import { importCollection, type ImportedCollection } from "../../core/import/collectionImport";
import { displayPrice, formatUsd } from "../../core/links";
import type { Color } from "../../core/types";
import { resolveCollection, type CollectionFilter, type OwnedCard, type ResolvedCollectionRow } from "../../data";
import { tauriDb } from "../../bridge/db";
import { Button, Callout, Card, EmptyState, Page, Spinner, formatCount, formatDate } from "../components";
import { AlertIcon, ArrowLeftIcon, CheckIcon, CollectionIcon, FolderIcon, ImportIcon, SearchIcon, TrashIcon } from "../icons";
import { useCollectionCards, useCollectionSummary, useCollectionUnresolved, useClearCollection, useImportCollection, useNameIndex } from "../queries";
import c from "./collection.module.css";
import d from "./decks.module.css";
import s from "./screens.module.css";

/**
 * Collection: import a ManaBox / TCGplayer / Moxfield CSV (replace or append), then browse what you own
 * as art tiles with search, color-identity and type filters. Read-only — ManaBox stays the source of truth (Q-008).
 * Dev: `?route=collection&importFile=<path>` opens the review step for that CSV.
 */

type Draft = { imported: ImportedCollection; fileName: string };
const COLORS: (Color | "C")[] = ["W", "U", "B", "R", "G", "C"];
const COLOR_WORD: Record<Color | "C", string> = { W: "white", U: "blue", B: "black", R: "red", G: "green", C: "colorless" };
const TYPES = ["Creature", "Instant", "Sorcery", "Artifact", "Enchantment", "Planeswalker", "Land"];
const PAGE = 60;

export function CollectionScreen() {
  const [draft, setDraft] = useState<Draft | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [reading, setReading] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  useNameIndex();

  const openPaths = useCallback(async (paths: string[]) => {
    const path = paths[0];
    if (!path) return;
    setReading(true);
    setLoadError(null);
    try {
      const file = await readImportFile(path);
      if (file.extension !== "csv") {
        setLoadError(`${file.fileName} is not a CSV. Collections come from ManaBox, TCGplayer, or Moxfield CSV exports; decklists go to Decks.`);
        return;
      }
      setDraft({ imported: importCollection(file.text, { fileName: file.fileName }), fileName: file.fileName });
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
      await openPaths(await pickImportFiles());
    } catch (e) {
      setLoadError(e instanceof Error ? e.message : String(e));
    }
  };

  if (draft) return <CollectionReview draft={draft} onDone={() => setDraft(null)} />;

  return (
    <Page
      title="Collection"
      subtitle="Cards you own, from a ManaBox, TCGplayer or Moxfield export. ManaBox stays the source of truth — MagicTrainer only reads it."
      actions={
        <Button variant="primary" onClick={() => void pick()} disabled={reading}>
          <ImportIcon /> Import CSV…
        </Button>
      }
    >
      {dragOver && <div className={d.dropOverlay}>Drop to import</div>}
      {loadError && (
        <Callout tone="danger" icon={<AlertIcon />}>
          {loadError}
        </Callout>
      )}
      <Browser onPick={() => void pick()} reading={reading} dragOver={dragOver} />
    </Page>
  );
}

// ---- browser ----------------------------------------------------------------------------

function Browser({ onPick, reading, dragOver }: { onPick: () => void; reading: boolean; dragOver: boolean }) {
  const summary = useCollectionSummary();
  const [text, setText] = useState("");
  const [debounced, setDebounced] = useState("");
  const [colors, setColors] = useState<(Color | "C")[]>([]);
  const [type, setType] = useState("");
  const [sort, setSort] = useState<NonNullable<CollectionFilter["sort"]>>("name");
  const [limit, setLimit] = useState(PAGE);
  const clear = useClearCollection();
  const [confirmClear, setConfirmClear] = useState(false);
  useEffect(() => {
    const t = setTimeout(() => setDebounced(text), 150);
    return () => clearTimeout(t);
  }, [text]);
  useEffect(() => setLimit(PAGE), [debounced, colors, type, sort]);
  const filter = useMemo<CollectionFilter>(() => ({ text: debounced || undefined, colors: colors.length ? colors : undefined, type: type || undefined, sort, limit }), [debounced, colors, type, sort, limit]);
  const hasCollection = (summary.data?.rows ?? 0) > 0;
  const cards = useCollectionCards(filter, hasCollection);
  const unresolved = useCollectionUnresolved(hasCollection && (summary.data?.unresolvedRows ?? 0) > 0);

  if (summary.isPending) {
    return (
      <div className={s.state} role="status">
        <Spinner /> Reading your collection…
      </div>
    );
  }
  if (summary.error) {
    return (
      <Callout tone="danger" icon={<AlertIcon />}>
        Could not read the collection: {summary.error instanceof Error ? summary.error.message : String(summary.error)}
      </Callout>
    );
  }
  if (!hasCollection) {
    return (
      <div className={c.emptyWrap}>
        <div className={`${d.dropZone} ${dragOver ? d.dropZoneActive : ""}`}>
          <ImportIcon />
          <div>
            <strong>Drop a ManaBox, TCGplayer or Moxfield CSV here</strong>
            <div className={d.muted}>ManaBox: Collection → Export → CSV. TCGplayer app: Collection → Export.</div>
          </div>
          <Button size="sm" onClick={onPick} disabled={reading}>
            <FolderIcon /> Choose file
          </Button>
        </div>
        <EmptyState icon={<CollectionIcon />} title="No collection yet" body="Once imported, upgrade and combo suggestions prefer cards you already own before anything you would buy." />
      </div>
    );
  }
  const sum = summary.data!;
  const toggleColor = (col: Color | "C") => setColors((cur) => (cur.includes(col) ? cur.filter((x) => x !== col) : [...cur, col]));

  return (
    <div className={c.layout}>
      <div className={c.summaryBar}>
        <Stat value={formatCount(sum.cards)} label="cards" />
        <Stat value={formatCount(sum.distinctCards)} label="distinct" />
        <Stat value={sum.valueUsd !== undefined ? formatUsd(sum.valueUsd) : "—"} label="est. value (TCGplayer market)" />
        <Stat value={sum.importedAt ? formatDate(sum.importedAt) : "—"} label={`imported${sum.sourceFormat ? ` · ${sum.sourceFormat.replace("-csv", "")}` : ""}`} />
        <div className={c.summaryActions}>
          {sum.unresolvedRows > 0 && <span className={`${d.chip} ${d.chipWarn}`}>{sum.unresolvedRows} unmatched rows</span>}
          {confirmClear ? (
            <>
              <span className={d.muted}>Remove the imported collection?</span>
              <Button size="sm" variant="ghost" onClick={() => setConfirmClear(false)}>
                Keep
              </Button>
              <Button size="sm" onClick={() => clear.mutate(undefined, { onSuccess: () => setConfirmClear(false) })} disabled={clear.isPending}>
                <TrashIcon /> Remove
              </Button>
            </>
          ) : (
            <Button size="sm" variant="ghost" onClick={() => setConfirmClear(true)}>
              <TrashIcon /> Remove collection
            </Button>
          )}
        </div>
      </div>

      <div className={c.filters} role="search">
        <div className={`${s.search} ${c.search}`}>
          <SearchIcon />
          <input className={s.searchInput} type="search" placeholder="Search your cards…" value={text} onChange={(e) => setText(e.target.value)} aria-label="Search the collection" autoComplete="off" spellCheck={false} />
        </div>
        <div className={c.colorToggles} role="group" aria-label="Color identity">
          {COLORS.map((col) => (
            <button key={col} type="button" className={`${c.colorToggle} ${colors.includes(col) ? c.colorToggleOn : ""}`} aria-pressed={colors.includes(col)} onClick={() => toggleColor(col)} title={COLOR_WORD[col]}>
              <span className={`${d.manaBadge} ${col === "C" ? "" : d[`mana${col}`]}`} aria-hidden="true">
                {col}
              </span>
              <span className="sr-only">{COLOR_WORD[col]}</span>
            </button>
          ))}
        </div>
        <select className={`${d.select} ${d.selectSm}`} value={type} onChange={(e) => setType(e.target.value)} aria-label="Card type">
          <option value="">All types</option>
          {TYPES.map((t) => (
            <option key={t} value={t}>
              {t}
            </option>
          ))}
        </select>
        <select className={`${d.select} ${d.selectSm}`} value={sort} onChange={(e) => setSort(e.target.value as NonNullable<CollectionFilter["sort"]>)} aria-label="Sort">
          <option value="name">Name</option>
          <option value="quantity">Most copies</option>
          <option value="price">Highest price</option>
          <option value="cmc">Mana value</option>
        </select>
      </div>

      {cards.isPending && (
        <div className={s.state} role="status">
          <Spinner /> Loading cards…
        </div>
      )}
      {cards.error && (
        <Callout tone="danger" icon={<AlertIcon />}>
          Could not load cards: {cards.error instanceof Error ? cards.error.message : String(cards.error)}
        </Callout>
      )}
      {cards.data && cards.data.length === 0 && (
        <div className={s.state} role="status">
          No owned cards match{debounced ? ` “${debounced}”` : ""}
          {colors.length ? ` in ${colors.map((x) => COLOR_WORD[x]).join("/")}` : ""}
          {type ? ` of type ${type}` : ""}.
        </div>
      )}
      {cards.data && cards.data.length > 0 && (
        <>
          <p className="sr-only" role="status">
            {cards.data.length} cards shown
          </p>
          <ul className={c.grid} aria-label="Owned cards">
            {cards.data.map((o) => (
              <Tile key={o.card.oracleId} owned={o} />
            ))}
          </ul>
          {cards.data.length >= limit && (
            <div className={d.row} style={{ justifyContent: "center" }}>
              <Button variant="ghost" onClick={() => setLimit((l) => l + PAGE)} disabled={cards.isFetching}>
                {cards.isFetching ? <Spinner /> : null} Show more
              </Button>
            </div>
          )}
        </>
      )}

      {unresolved.data && unresolved.data.length > 0 && (
        <Card title={`${sum.unresolvedRows} rows did not match a card`}>
          <p className={d.muted}>These rows were kept but are not counted as owned. Usually a typo, a token, or a very new set.</p>
          <ul className={c.unresolvedList}>
            {unresolved.data.slice(0, 30).map((r, i) => (
              <li key={`${r.name}-${i}`}>
                {r.quantity}× {r.name}
                {r.setCode ? ` (${r.setCode.toUpperCase()}${r.collectorNumber ? ` ${r.collectorNumber}` : ""})` : ""}
              </li>
            ))}
            {unresolved.data.length > 30 && <li>…and {unresolved.data.length - 30} more</li>}
          </ul>
        </Card>
      )}
    </div>
  );
}

function Stat({ value, label }: { value: string; label: string }) {
  return (
    <div className={d.count}>
      <span className={d.countVal}>{value}</span>
      <span className={d.countKey}>{label}</span>
    </div>
  );
}

function Tile({ owned }: { owned: OwnedCard }) {
  const { card } = owned;
  const art = cardImageSrc(card.imageUris?.art_crop);
  const price = owned.priceUsd ?? displayPrice(card.prices);
  return (
    <li className={c.tile} title={`${card.name} — ${card.typeLine}${card.oracleText ? `\n${card.oracleText}` : ""}`}>
      <div className={c.tileArt}>
        {art ? <img src={art} alt="" loading="lazy" decoding="async" /> : <div className={c.tileArtEmpty} aria-hidden="true" />}
        <span className={c.qty} aria-label={`${owned.quantity} owned`}>
          ×{owned.quantity}
        </span>
        {owned.foilQuantity > 0 && <span className={c.foil}>foil</span>}
      </div>
      <div className={c.tileBody}>
        <span className={c.tileName}>{card.name}</span>
        <span className={c.tileMeta}>
          <span>{card.typeLine.split(" — ")[0]?.replace("Legendary ", "")}</span>
          {price !== undefined && <span className={d.price}>{formatUsd(price)}</span>}
        </span>
      </div>
    </li>
  );
}

// ---- review ----------------------------------------------------------------------------

function CollectionReview({ draft, onDone }: { draft: Draft; onDone: () => void }) {
  const { imported, fileName } = draft;
  const index = useNameIndex();
  const summary = useCollectionSummary();
  const importRows = useImportCollection();
  const [mode, setMode] = useState<"replace" | "append">("replace");
  const [rows, setRows] = useState<ResolvedCollectionRow[] | null>(null);
  const [resolveError, setResolveError] = useState<string | null>(null);
  const seq = useRef(0);

  useEffect(() => {
    if (!index.data) return;
    const id = ++seq.current;
    setRows(null);
    resolveCollection(tauriDb, index.data, imported.entries)
      .then((r) => {
        if (id === seq.current) setRows(r);
      })
      .catch((e: unknown) => {
        if (id === seq.current) setResolveError(e instanceof Error ? e.message : String(e));
      });
  }, [index.data, imported.entries]);

  const counts = useMemo(() => {
    const out = { "scryfall-id": 0, "set-number": 0, name: 0, unresolved: 0 };
    for (const r of rows ?? []) out[r.method] += 1;
    return out;
  }, [rows]);
  const unresolvedRows = (rows ?? []).filter((r) => r.method === "unresolved");
  const existing = summary.data?.rows ?? 0;

  const save = () => {
    if (!rows) return;
    importRows.mutate({ rows, sourceFormat: imported.format, mode }, { onSuccess: onDone });
  };

  return (
    <Page
      title="Review collection import"
      subtitle={`From ${fileName}. Nothing is written until you confirm.`}
      actions={
        <div className={d.row}>
          <Button variant="ghost" onClick={onDone}>
            <ArrowLeftIcon /> Back
          </Button>
          <Button variant="primary" onClick={save} disabled={!rows || rows.length === 0 || importRows.isPending}>
            {importRows.isPending ? <Spinner /> : <CheckIcon />} {mode === "replace" ? "Replace collection" : "Add to collection"}
          </Button>
        </div>
      }
    >
      <div className={d.review}>
        <div className={d.reviewMain}>
          <Card>
            <div className={d.counts}>
              <Stat value={formatCount(imported.entries.length)} label="rows" />
              <Stat value={formatCount(imported.totalCards)} label="cards" />
              <Stat value={imported.format === "unknown" ? "?" : imported.format.replace("-csv", "")} label="format" />
              <Stat value={rows ? formatCount(counts["scryfall-id"] + counts["set-number"]) : "…"} label="matched to a printing" />
              <Stat value={rows ? formatCount(counts.name) : "…"} label="matched by name" />
              <Stat value={rows ? formatCount(counts.unresolved) : "…"} label="unmatched" />
            </div>
            {existing > 0 && (
              <div className={d.actions} role="radiogroup" aria-label="Import mode">
                <label className={s.check} style={{ marginTop: 0 }}>
                  <input type="radio" name="mode" checked={mode === "replace"} onChange={() => setMode("replace")} /> Replace the {formatCount(existing)} rows already imported (full export)
                </label>
                <label className={s.check} style={{ marginTop: 0 }}>
                  <input type="radio" name="mode" checked={mode === "append"} onChange={() => setMode("append")} /> Add to them (partial export)
                </label>
              </div>
            )}
          </Card>
          {imported.errors.length > 0 && (
            <Callout tone="danger" icon={<AlertIcon />}>
              {imported.errors.length} row{imported.errors.length === 1 ? "" : "s"} could not be read:
              <ul className={d.list}>
                {imported.errors.slice(0, 8).map((e, i) => (
                  <li key={i}>{e}</li>
                ))}
              </ul>
            </Callout>
          )}
          {imported.warnings.map((w) => (
            <Callout key={w} tone="warn" icon={<AlertIcon />}>
              {w}
            </Callout>
          ))}
          {resolveError && (
            <Callout tone="danger" icon={<AlertIcon />}>
              Could not match cards: {resolveError}
            </Callout>
          )}
          {(index.isPending || (index.data && !rows && !resolveError)) && (
            <div className={s.state} role="status" style={{ marginTop: 0 }}>
              <Spinner /> Matching {formatCount(imported.entries.length)} rows to Scryfall printings…
            </div>
          )}
          {rows && unresolvedRows.length > 0 && (
            <Card title={`${unresolvedRows.length} rows will be kept but not matched`}>
              <ul className={c.unresolvedList}>
                {unresolvedRows.slice(0, 40).map((r, i) => (
                  <li key={`${r.entry.name}-${i}`}>
                    {r.entry.quantity}× {r.entry.name}
                    {r.entry.setCode ? ` (${r.entry.setCode.toUpperCase()}${r.entry.collectorNumber ? ` ${r.entry.collectorNumber}` : ""})` : ""}
                  </li>
                ))}
                {unresolvedRows.length > 40 && <li>…and {unresolvedRows.length - 40} more</li>}
              </ul>
            </Card>
          )}
          {rows && unresolvedRows.length === 0 && (
            <p className={d.resolvedNote}>
              <CheckIcon /> Every row matched a Scryfall card.
            </p>
          )}
          {importRows.isError && (
            <Callout tone="danger" icon={<AlertIcon />}>
              Import failed: {importRows.error instanceof Error ? importRows.error.message : String(importRows.error)}
            </Callout>
          )}
        </div>
        <aside className={d.reviewSide} aria-label="What happens">
          <Card title="What happens on import">
            <ul className={d.list}>
              <li>Rows are stored locally with their printing (set + collector number) when the export has one, so prices and art follow the exact card.</li>
              <li>Owned counts drive “owned first” suggestions in the Strategy panel.</li>
              <li>Nothing is written back to ManaBox — re-export there and import again to update.</li>
            </ul>
          </Card>
        </aside>
      </div>
    </Page>
  );
}
