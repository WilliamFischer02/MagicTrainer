import { useEffect } from "react";
import { citation } from "../bridge/rules";
import { formatCount } from "./components";
import { BuilderIcon, CloseIcon, CollectionIcon, CopyIcon, DeckIcon, RulesIcon, SettingsIcon, Sigil, TrainerIcon } from "./icons";
import { CollectionScreen } from "./screens/CollectionScreen";
import { DataScreen } from "./screens/DataScreen";
import { DecksScreen } from "./screens/DecksScreen";
import { RulesScreen } from "./screens/RulesScreen";
import s from "./shell.module.css";
import { ROUTES, useAppStore, type Route } from "./store";

const ROUTE_ICON: Record<Route, typeof DeckIcon> = {
  decks: DeckIcon,
  collection: CollectionIcon,
  rules: RulesIcon,
  settings: SettingsIcon,
};

export function AppShell() {
  const { mode, route, setMode, navigate, refreshDb } = useAppStore();
  useEffect(() => {
    void refreshDb();
  }, [refreshDb]);

  return (
    <div className={s.shell}>
      <nav className={s.rail} aria-label="Primary">
        <div className={s.brand}>
          <Sigil />
          <div className={s.brandText}>
            <span className={s.brandName}>MagicTrainer</span>
            <span className={s.brandMode}>{mode === "builder" ? "Deck Builder" : "Deck Trainer"}</span>
          </div>
        </div>

        <div className={s.segment} role="radiogroup" aria-label="Mode">
          <button type="button" role="radio" className={s.segmentBtn} aria-checked={mode === "builder"} onClick={() => setMode("builder")}>
            <BuilderIcon width={16} height={16} /> Builder
          </button>
          <button type="button" role="radio" className={s.segmentBtn} aria-checked={mode === "trainer"} onClick={() => setMode("trainer")}>
            <TrainerIcon width={16} height={16} /> Trainer
          </button>
        </div>

        <div className={s.nav}>
          {ROUTES.map((r) => {
            const Icon = ROUTE_ICON[r.id];
            return (
              <button key={r.id} type="button" className={s.navBtn} aria-current={route === r.id ? "page" : undefined} title={r.hint} onClick={() => navigate(r.id)}>
                <Icon />
                {r.label}
              </button>
            );
          })}
        </div>

        <div className={s.railFooter}>
          <DataPill />
          <span className={s.version}>v0.1.0 · Phase 1</span>
        </div>
      </nav>

      <main className={s.main}>
        {route === "decks" && <DecksScreen />}
        {route === "collection" && <CollectionScreen />}
        {route === "rules" && <RulesScreen />}
        {route === "settings" && <DataScreen />}
      </main>

      <ContextPanel />
    </div>
  );
}

function DataPill() {
  const { db, dbError, navigate } = useAppStore();
  let dot = s.dot;
  let text = "Checking card data…";
  if (dbError) {
    dot = `${s.dot} ${s.dotBad}`;
    text = "Card data unavailable";
  } else if (db && !db.exists) {
    dot = `${s.dot} ${s.dotWarn}`;
    text = "No card data yet — set up";
  } else if (db) {
    const cards = db.counts.cards ?? 0;
    dot = `${s.dot} ${cards > 0 ? s.dotOk : s.dotWarn}`;
    text = cards > 0 ? `${formatCount(cards)} cards · ${formatCount(db.counts.spellbook_variants ?? 0)} combos` : "Card data empty — import";
  }
  return (
    <button type="button" className={s.dataPill} onClick={() => navigate("settings")} aria-label={`Open data settings. ${text}`}>
      <span className={dot} aria-hidden="true" />
      <span>{text}</span>
    </button>
  );
}

function ContextPanel() {
  const { context, setContext } = useAppStore();
  if (!context) return null;
  const { entry } = context;
  const cite = citation(entry);
  const copy = () => {
    navigator.clipboard?.writeText(cite).catch((e: unknown) => console.error("clipboard", e));
  };
  return (
    <aside className={s.context} aria-label="Rule detail">
      <div className={s.contextHead}>
        <span className={s.contextTitle}>{entry.kind === "glossary" ? "Glossary" : "Comprehensive Rules"}</span>
        <div>
          <button type="button" className={s.iconBtn} onClick={copy} title={`Copy "${cite}"`} aria-label={`Copy citation ${cite}`}>
            <CopyIcon />
          </button>
          <button type="button" className={s.iconBtn} onClick={() => setContext(null)} title="Close" aria-label="Close rule detail">
            <CloseIcon />
          </button>
        </div>
      </div>
      <div className={s.contextBody}>
        <div className={s.ruleNumber}>{entry.number}</div>
        <div className={s.ruleSection}>{entry.section}</div>
        <p className={s.ruleText}>{entry.text}</p>
      </div>
    </aside>
  );
}
