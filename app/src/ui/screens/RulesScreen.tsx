import { useEffect, useRef, useState } from "react";
import { rulesSearch, rulesStatus, type RuleEntry, type RulesStatus } from "../../bridge/rules";
import { Callout, Page, Spinner } from "../components";
import { AlertIcon, SearchIcon } from "../icons";
import { useAppStore } from "../store";
import s from "./screens.module.css";

const EXAMPLES: { q: string; why: string }[] = [
  { q: "704.5a", why: "0 or less life" },
  { q: "603.6c", why: "leaves-the-battlefield triggers" },
  { q: "601.2", why: "casting a spell" },
  { q: "sacrifice cost", why: "keyword search" },
  { q: "Dies", why: "glossary term" },
];

type Status = { kind: "idle" } | { kind: "loading" } | { kind: "error"; message: string } | { kind: "results"; hits: RuleEntry[]; query: string };

export function RulesScreen() {
  const [query, setQuery] = useState(() => new URLSearchParams(globalThis.location?.search ?? "").get("q") ?? "");
  const [status, setStatus] = useState<Status>({ kind: "idle" });
  const [info, setInfo] = useState<RulesStatus | null>(null);
  const [infoError, setInfoError] = useState<string | null>(null);
  const { context, setContext } = useAppStore();
  const inputRef = useRef<HTMLInputElement>(null);
  const seq = useRef(0);

  useEffect(() => {
    inputRef.current?.focus();
    rulesStatus()
      .then(setInfo)
      .catch((e: unknown) => setInfoError(e instanceof Error ? e.message : String(e)));
  }, []);

  useEffect(() => {
    const q = query.trim();
    if (!q) {
      setStatus({ kind: "idle" });
      return;
    }
    const id = ++seq.current;
    const timer = setTimeout(() => {
      setStatus({ kind: "loading" });
      rulesSearch(q, 40)
        .then((hits) => {
          if (id === seq.current) setStatus({ kind: "results", hits, query: q });
        })
        .catch((e: unknown) => {
          if (id === seq.current) setStatus({ kind: "error", message: e instanceof Error ? e.message : String(e) });
        });
    }, 150);
    return () => clearTimeout(timer);
  }, [query]);

  const selected = context?.kind === "rule" ? context.entry : null;

  return (
    <Page title="Rules" subtitle="Search the Comprehensive Rules by rule number or keyword. Selected rules open in the side panel for citation.">
      <div className={s.search}>
        <SearchIcon />
        <input
          ref={inputRef}
          className={s.searchInput}
          type="search"
          placeholder="Rule number (603.6c) or words (sacrifice cost)…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          aria-label="Search the Comprehensive Rules"
          autoComplete="off"
          spellCheck={false}
        />
      </div>
      <div className={s.meta}>
        {info && (
          <span>
            Comprehensive Rules effective {info.effective ?? "unknown date"} · {info.entries.toLocaleString()} entries
          </span>
        )}
        {infoError && <span role="alert">Rules files unavailable: {infoError}</span>}
      </div>

      {status.kind === "idle" && (
        <div className={s.chips} aria-label="Example searches">
          {EXAMPLES.map((ex) => (
            <button key={ex.q} type="button" className={s.chip} onClick={() => setQuery(ex.q)}>
              <code>{ex.q}</code>&nbsp;· {ex.why}
            </button>
          ))}
        </div>
      )}

      {status.kind === "loading" && (
        <div className={s.state} role="status">
          <Spinner /> Searching…
        </div>
      )}

      {status.kind === "error" && (
        <div className={s.results}>
          <Callout tone="danger" icon={<AlertIcon />}>
            Search failed: {status.message}. The rules files ship with the app under <code>knowledge/mtg-rules</code>; if this persists, reinstall.
          </Callout>
        </div>
      )}

      {status.kind === "results" && status.hits.length === 0 && (
        <div className={s.state} role="status">
          No rule matches “{status.query}”. Try a rule number like <code>702.19</code> or fewer, simpler words.
        </div>
      )}

      {status.kind === "results" && status.hits.length > 0 && (
        <div className={s.results}>
          <p className="sr-only" role="status">
            {status.hits.length} results
          </p>
          {status.hits.map((h) => (
            <button
              key={`${h.kind}:${h.number}`}
              type="button"
              className={s.hit}
              aria-pressed={selected?.number === h.number && selected.kind === h.kind}
              onClick={() => setContext({ kind: "rule", entry: h })}
            >
              <span className={`${s.hitNumber} ${h.kind === "glossary" ? s.hitGlossary : ""}`}>{h.number}</span>
              <span className={s.hitText}>{h.text}</span>
              <span className={s.hitSection}>{h.section}</span>
            </button>
          ))}
        </div>
      )}
    </Page>
  );
}
