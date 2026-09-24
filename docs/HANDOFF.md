# Session Handoff

The agent rewrites this file at the end of every session (and every ~2 hours of unattended work).
It is the first thing the next session reads after CLAUDE.md.

## Last session
- **Date:** 2026-09-24 · **By:** Claude (Fable 5.1, Claude Code) · **Duration:** ~2.5 h unattended
- **State:** **Phase 0 done. Phase 1 (data spine) done except the two follow-ups below.** `main` is green:
  61 Vitest (incl. real-DB proof), 11 cargo tests, `tsc` clean, `cargo clippy` clean, `npm run tauri dev` opens the shell.
- **Bottom line:** the repo is repaired and structured, the Rust importer builds a 900 MB local SQLite from Scryfall +
  Spellbook in ~60 s, all six of William's decks resolve with 0 unresolved names, the board renderer is decided
  (React DOM + SVG + Motion, D-006), and the app shell (rail, rules viewer, data settings) is live on the real data.

## Next 3 actions (in order)
1. **Phase 1 leftovers:** (a) TanStack Query hooks around `src/data` + a card-image disk cache (Rust command, ≤ 10 rps,
   User-Agent, `%LOCALAPPDATA%\MagicTrainer\cache\images`); (b) Spellbook `find-my-combos` client with 24 h on-disk cache
   (default online path per Q-013; bulk stays opt-in).
2. **Phase 2 · Import UI:** drag-drop / file dialog (`tauri-plugin-dialog` is already registered) → parser → `resolveDeckNames`
   → unresolved-name fixer using `searchCardNames` (FTS) → save to `decks` / `deck_entries`. Start with the six sample decks.
3. **Phase 2 · Deck view + strategy panel:** curve, color sources vs pips, `detectStrategies` results with rationale, near-miss.
   Before that, run a `strategy-analyst` pass over `patterns.ts` tag slugs against the real `oracle_tags` table
   (e.g. Blood Artist's direct tags are `blood-artist-ability`, `opponent-loses-life`; ancestors add `death-trigger`, `lifegain`).

## Open risks / unknowns
- **DB size:** `data/magictrainer.sqlite` is ~900 MB with printings + Spellbook (`spellbook_variants.json` projection is the bulk).
  Trim the projection or drop `json` in favor of the normalized tables before v1.0 first-run UX. Scryfall-only DB is ~190 MB.
- **Spellbook bulk file** inflates to 664 MB (PowerShell wrote it inflated; importer sniffs gzip magic — D-011a). True compressed
  size still unmeasured; the Rust downloader will report it. Q-013 provisional: combos opt-in.
- **Perf numbers are from an RTX 5070 desktop** (D-006 table); re-measure the board on integrated graphics in Phase 4.
- **2× DPI screenshot review not done** (no HiDPI display on this box). All sizes are token-based; card art not rendered yet.
- **Claude-in-Chrome extension is not connected on this machine** — browser-based checks fail. Use the WebView2 workflow below.
- `tauri.conf.json` still has `"csp": null` (dev). Set a real CSP in Phase 4.
- Rules files are dated 2026-06-19 (CR) / 2026-07-03 (B&R): < 90 days old today; check again after 2026-09-17… already past —
  **CR is 97 days old**; run `scripts/refresh-rules.ps1` when a rules note needs a current citation (no code depends on the date).

## How to verify things unattended (worked this session)
- **Build the local DB:** `cd app/src-tauri && cargo run --release --bin magictrainer-import -- --data ../../data`
  (`--parts oracle_cards,rulings,oracle_tags` for a fast 190 MB DB). Real-DB Vitest tests auto-skip when it is absent.
- **Run the app on the repo data:** `MAGICTRAINER_DATA_DIR=C:\dev\MagicTrainer\data npm run tauri dev` (in `app/`).
- **Open a specific screen:** `npx tauri dev --config <json>` with `{"build":{"devUrl":"http://localhost:1420/?route=rules&q=603.6"}}`;
  params: `route=decks|collection|rules|settings`, `mode=builder|trainer`, `q=`.
- **Screenshot the window without focus games:** PowerShell `PrintWindow(hwnd, hdc, 2)` on the `magictrainer` process
  (script pattern in this session's scratchpad; recreate in `scripts/` if needed). `SetForegroundWindow` is denied here.
- **Board spike:** `/spike.html?mode=pixi|svg&dpr=1|2&sprites=150&arrows=40&collector=http://localhost:1421/report&autoclose=1`.
- **If `tauri dev` says port 1420 is in use:** a previous Vite survived; kill the PID from `netstat -ano | findstr :1420`.

## Where things are
- Rust: `app/src-tauri/rust/` — `db.rs` (schema v1), `import/{scryfall,spellbook}.rs`, `download.rs`, `rules.rs`, `commands.rs`, `bin/import.rs`
- TS data layer: `app/src/data/` (DbClient seam, card queries, NameIndex loader) · bridge: `app/src/bridge/` (db, bulk, rules)
- Core: `app/src/core/` — parsers, `resolve/` (normalizer + NameIndex), strategy patterns/detector, trajectory templates
- UI: `app/src/ui/` — `tokens.css`, `AppShell.tsx`, `screens/`, `components.tsx`, `store.ts`
- Spike: `app/spike.html`, `app/src/spike/`
- Decisions this session: D-006 (resolved), D-009, D-010, D-011/D-011a · Questions: Q-013 added (13 open, all provisional)
