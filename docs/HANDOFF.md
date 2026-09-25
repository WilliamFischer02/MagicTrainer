# Session Handoff

The agent rewrites this file at the end of every session (and every ~2 hours of unattended work).
It is the first thing the next session reads after CLAUDE.md.

## Last session
- **Date:** 2026-09-24 → 25 (overnight) · **By:** Claude (Fable 5.1, Claude Code) · **Duration:** ~5.5 h unattended
- **State:** **Phase 1 done. Phase 2 (Deck Builder MVP) done.** `main` is green: 169 Vitest (incl. 19 real-DB tests + 6 golden
  strategy tests), 31 cargo tests, `tsc` clean, `cargo clippy` clean. Every screen was screenshotted in the real Tauri window.
- **Bottom line:** the Deck Builder is usable end to end — import (drop / dialog / paste) → name fixer → save → deck view with commander
  art hero, curve, pips vs sources, role coverage vs the Commander skeleton, legality, detected strategies with "Why?", live Commander
  Spellbook combos + near-misses (price, Card Kingdom link, "you own n"), a React Flow deck graph, and Moxfield / Arena / MTGO export.
  The Collection screen imports ManaBox / TCGplayer / Moxfield CSVs with printing-level matching and browses owned cards as art tiles.
  All six of William's decks import with 0 unresolved and hit their expected archetype in golden tests.

## Next 3 actions (in order)
1. **Phase 3 · Board scene** (`docs/VISUALIZATION_SPEC.md`, D-006: React DOM + SVG + Motion): `app/src/board/` — 7 zones per side,
   card sprites (art crops via `cardImageSrc`), zone counters, life/mana HUD. Reuse the spike's SVG arrow overlay (`src/spike/svgScene.tsx`).
   Start with a static board fed by a `Playline` from `core/trajectory/templates.ts` (aristocrats-loop / drain-loop already exist).
2. **Phase 3 · Playline engine + scrubber:** merge user playline + opponent track by (turn, phase); play/pause/step/speed; reduced-motion.
   `opponent-tracks/` has two JSON tracks; write the Zod loader in `core/opponent/` first (roadmap item).
3. **Phase 3 · Step panel:** why (CR citation → `rulesGet`, opens the existing context panel), mana/cards/life ledger, break points.

Queued (small, any time): ESLint + `no-restricted-imports` dependency rule (eslint not installed); Settings toggle for automatic Spellbook
lookups (Q-014); collection list view + tag filter; 2× DPI screenshot pass. Sample decks were renamed by archetype (2026-09-25).

## Open risks / unknowns
- **Combo lookups POST the decklist to Commander Spellbook when a deck opens** (Q-014). Offline falls back to the 24 h disk cache.
- **Detection is heuristic.** 14 patterns; golden tests only cover the six sample decks; the 500-card false-positive sweep is not done.
- **Graph layout is a first cut.** Deterministic ring/fan layout; large role hubs still crowd at fit-to-view zoom. Consider ELK/dagre
  only if a real deck looks bad — the core model (`buildDeckGraph`) is layout-agnostic.
- **DB size** ~900 MB with printings + Spellbook. Trim before v1.0 first-run UX. **CSP still `null`** (needs `img-src http://mtimg.localhost`).
- **Image cache** is capped at 10 req/s; a 100-card board warms in ~10 s the first time. Prefetch currently warms only commander art.
- Perf numbers are from an RTX 5070 desktop; re-measure the board on integrated graphics in Phase 4. CR text is 97 days old.

## How to verify things unattended (worked this session)
- **DB:** `cd app/src-tauri && cargo run --release --bin magictrainer-import -- --data ../../data`.
- **App on repo data:** `MAGICTRAINER_DATA_DIR=C:\dev\MagicTrainer\data npm run tauri dev` (in `app/`); caches land in `data/cache/` (gitignored).
- **Open a screen:** `npx tauri dev --config <json>` with `{"build":{"devUrl":"http://localhost:1420/?route=decks&deck=<id>&view=graph"}}`;
  params: `route=decks|collection|rules|settings`, `mode=`, `q=`, `deck=<id>`, `view=graph`, `importFile=<path>` (decks or collection review).
- **Screenshot:** `powershell -File scripts/screenshot-window.ps1 -Out shot.png` (PrintWindow; no focus needed). Take a second shot if the
  first one catches Vite re-optimizing after a lockfile change.
- **Diagnostics / seeding:** `/diag.html?collector=http://127.0.0.1:1421/report&autoclose=1` (image protocol, Spellbook client, deck IPC
  round-trip → JSON report); `/diag.html?seed=<dir>&files=a.txt,b.txt` seeds decks; `/diag.html?seedCollection=<csv>` seeds a collection.
  Collector = tiny Python `http.server` writing the POST body to a file (pattern in the session scratchpad; trivial to recreate).
- **Real-DB Vitest** auto-skips without the DB; `nodeDb.ts` sets `busy_timeout` (parallel workers otherwise report "database is locked" as skipped).
- **Tool gotchas on this box:** Bash-tool heredocs > ~6 KB get mangled → write patch scripts to the scratchpad with the Write tool; Python
  non-raw `\b` writes a literal backspace; Python text writes emit CRLF (use `newline=""`); `grep -c` exits 1 on zero matches and breaks `&&` chains.
- **Port 1420 busy:** kill the PID from `netstat -ano | findstr :1420`.

## Where things are
- Rust: `app/src-tauri/rust/` — `db.rs`, `import/`, `download.rs`, `net.rs`, `images.rs` (mtimg), `spellbook_api.rs`, `decks.rs`
  (save/delete/read_import_file/write_text_file), `collection.rs`, `rules.rs`, `commands.rs` (async db_query/db_status), `bin/import.rs`
- Core: `app/src/core/` — parsers, `resolve/`, `strategy/` (14 patterns, detector with anyOf/gate, spellbook mapping), `import/`
  (deck + collection), `export/decklist.ts`, `math/deckStats.ts`, `graph/deckGraph.ts`, `links.ts`, trajectory templates
- Data: `app/src/data/` — cards, nameIndex, decks, collection · Bridge: `app/src/bridge/` — db, bulk, rules, images, spellbook, decks, collection
- UI: `app/src/ui/` — `queries.ts` (TanStack), `store.ts`, screens: Decks (library / detail / import review / export), DeckAnalysis,
  StrategyPanel, DeckGraph, Collection (browser / review), Data (settings + caches), Rules
- Dev: `app/diag.html` + `src/diag/`, `app/spike.html` + `src/spike/`, `scripts/screenshot-window.ps1`
- Decisions this session: D-012…D-016 · Questions: all 14 accepted by William on 2026-09-25 (OPEN block is empty) · UI review + strategy audit
  findings were applied (see commit messages 5530585…0cb7d2b)
