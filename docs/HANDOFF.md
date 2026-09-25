# Session Handoff

The agent rewrites this file at the end of every session (and every ~2 hours of unattended work).
It is the first thing the next session reads after CLAUDE.md.

## Last session
- **Date:** 2026-09-24 (evening) · **By:** Claude (Fable 5.1, Claude Code) · **Duration:** ~3.5 h unattended
- **State:** **Phase 1 done. Phase 2 (Deck Builder) ~60 %: import UI, deck view + analysis, strategy panel done; collection view,
  deck graph, export open.** `main` is green: 152 Vitest (incl. 16 real-DB tests + 6 golden strategy tests), 28 cargo tests,
  `tsc` clean, `cargo clippy` clean.
- **Bottom line:** the app now imports a deck (drop / file dialog / paste), fixes unknown names with a candidate picker, saves it,
  and shows a commercial-looking deck view: commander art hero, mana curve, pips vs sources, role coverage vs the Commander
  skeleton, legality, detected strategies with "Why?", and live Commander Spellbook combos + near-misses with prices.
  All six of William's decks import with 0 unresolved and hit their expected archetype.

## Next 3 actions (in order)
1. **Phase 2 · Export:** decklist text in Moxfield / Arena dialects (`core/export/`), copy-to-clipboard + save-file (dialog plugin is
   installed). Pure function + tests first; button on the deck hero.
2. **Phase 2 · Collection:** ManaBox / TCGplayer CSV → `collection` table (Rust `collection_import` write command, mirrors
   `decks.rs`), `data/collection.ts` reads, grid/list screen with search + color/type/tag filters, owned-qty on card rows; then
   near-miss suggestions become "owned first" (StrategyPanel already has the price/CK link half).
3. **Phase 2 · Deck graph:** `@xyflow/react` (not installed yet) — cards as nodes, role edges from `StrategyMatch.roles`, combo
   clusters from Spellbook `included` variants. Then Phase 3 board (`docs/VISUALIZATION_SPEC.md`).

Also queued (small): ESLint + `no-restricted-imports` dependency rule (eslint is not installed; `npm run lint` fails); rename the
sample decks "Pink"/"Purple" (they are William's own names — ask, don't rename silently); 2× DPI screenshot pass.

## Open risks / unknowns
- **Combo lookups send the decklist to Commander Spellbook automatically when a deck opens** (Q-014, provisional yes). Needs a
  Settings toggle before v1.0; offline falls back to the 24 h disk cache (stale flagged).
- **Detection is heuristic and tag-driven.** Golden tests only cover William's six decks; the 500-card false-positive sweep in
  STRATEGY_DETECTION.md is not implemented. `control` and `creature-aggro` use whole-deck gates (creature share / avg MV).
- **DB size:** `data/magictrainer.sqlite` is ~900 MB with printings + Spellbook. Trim before v1.0 first-run UX.
- **Images:** `mtimg` cache is capped at 10 req/s (CLAUDE.md); a 100-card deck warms in ~10 s the first time. Prefetch on deck open
  currently warms only the commander art; widen when the board needs art crops.
- **CSP is still `null`** (dev). Production CSP must allow `img-src http://mtimg.localhost` (D-012).
- **Perf numbers are from an RTX 5070 desktop.** Re-measure the board on integrated graphics in Phase 4.
- CR text is 97 days old; run `scripts/refresh-rules.ps1` when a rules note needs a current citation.

## How to verify things unattended (worked this session)
- **Build the local DB:** `cd app/src-tauri && cargo run --release --bin magictrainer-import -- --data ../../data`.
- **Run the app on the repo data:** `MAGICTRAINER_DATA_DIR=C:\dev\MagicTrainer\data npm run tauri dev` (in `app/`). Caches then live
  in `data/cache/` (gitignored).
- **Open a specific screen:** `npx tauri dev --config <json>` with `{"build":{"devUrl":"http://localhost:1420/?route=decks&deck=<id>"}}`;
  params: `route=decks|collection|rules|settings`, `mode=`, `q=`, `deck=<id>`, `importFile=<path>` (opens the review screen).
- **Screenshot without focus:** `powershell -File scripts/screenshot-window.ps1 -Out shot.png` (PrintWindow; works while the agent
  cannot foreground windows). First screenshot after a `package-lock` change may catch Vite re-optimizing — take a second one.
- **Diagnostics page:** `/diag.html?collector=http://127.0.0.1:1421/report&autoclose=1` checks the image protocol, the Spellbook client
  and the deck IPC round-trip and POSTs a JSON report; `/diag.html?seed=<dir>&files=a.txt,b.txt` imports decks through the real
  pipeline (how the six sample decks were seeded). Collector script pattern: tiny Python `http.server` writing the POST body to a file.
- **Real-DB Vitest:** `src/data/__tests__/*.test.ts` auto-skip when the DB is absent; `nodeDb.ts` sets `busy_timeout` so parallel
  workers don't hit "database is locked".
- **Heredoc gotcha on this box:** long (> ~6 KB) heredocs through the Bash tool get mangled, and Python `\b` in non-raw strings writes a
  literal backspace. Write patch scripts to the scratchpad with the Write tool, then run them.
- **If `tauri dev` says port 1420 is in use:** kill the PID from `netstat -ano | findstr :1420`.

## Where things are
- Rust: `app/src-tauri/rust/` — `db.rs`, `import/`, `download.rs`, `net.rs` (UA + limiter), `images.rs` (mtimg), `spellbook_api.rs`,
  `decks.rs` (save/delete/read_import_file), `rules.rs`, `commands.rs`, `bin/import.rs`
- Core: `app/src/core/` — parsers, `resolve/`, `strategy/` (patterns 14, detector, spellbook mapping), `import/deckImport.ts`,
  `math/deckStats.ts`, `links.ts`, trajectory templates
- Data: `app/src/data/` — cards (SQL + Zod), nameIndex, decks · Bridge: `app/src/bridge/` — db, bulk, rules, images, spellbook, decks
- UI: `app/src/ui/` — `queries.ts` (TanStack), `store.ts` (UI state only), screens: Decks (library/detail/import review), DeckAnalysis,
  StrategyPanel, Data (settings + caches), Rules, Collection (placeholder)
- Dev: `app/diag.html` + `src/diag/`, `app/spike.html` + `src/spike/`, `scripts/screenshot-window.ps1`
- Decisions this session: D-012 (mtimg image cache, local app data), D-013 (Spellbook client), D-014 (TanStack Query), D-015 (detection
  gates + golden sets) · Questions: Q-004 updated, Q-014 added (14 open, all provisional)
