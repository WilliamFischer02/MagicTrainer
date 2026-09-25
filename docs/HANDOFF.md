# Session Handoff

The agent rewrites this file at the end of every session (and every ~2 hours of unattended work).
It is the first thing the next session reads after CLAUDE.md.

## Last session
- **Date:** 2026-09-25 · **By:** Claude (Fable 5.1, Claude Code) · **Duration:** ~3 h unattended (continuation of the 09-24 session)
- **State:** **Phases 1–3 done (MVP level).** `main` is green: 195 Vitest (incl. 20 real-DB tests + 6 golden strategy tests + 7 track
  validations), 31 cargo tests, `tsc` clean, `cargo clippy` clean. Every screen was screenshotted in the real Tauri window.
- **Bottom line:** the Deck Trainer works end to end — pick a saved deck, a detected playline, and a scripted opponent; the board
  animates card moves as arrows across seven zones per side with a life/hand/mana ledger, a scrubber with turn ticks, autoplay,
  and a step panel whose "why" cites the CR (click → rules viewer) and whose break points name the interaction that stops the line.
  Eight playline templates cover all six of William's decks; seven opponent tracks ship, every real card name verified against
  Scryfall data by test and every CR/MTR citation checked against the bundled rules (rules-judge pass applied).
- William accepted all 14 provisional decisions ("accept all", D-017) and had the sample decks renamed by archetype.

## Next 3 actions (in order)
1. **Phase 4 · Onboarding + first-run download flow + offline mode** (`docs/ROADMAP.md`): first launch with no DB → guided Scryfall
   download (Settings already has the importer + progress); combos opt-in per Q-013; detect offline and degrade (Spellbook stale cache
   already flagged). Then set a real CSP in `tauri.conf.json` (`img-src http://mtimg.localhost`, `connect-src` for the two APIs).
2. **Phase 4 · Accessibility + polish pass** with the UI-review leftovers: heading order in panels, `consequence` field in the step panel
   (spec lists it separately from "why"), collection list view + tag filter, 2× DPI screenshot pass, ESLint + dependency-direction rule.
3. **Phase 4 · Playwright E2E on the built app; `tauri build` MSI/NSIS; README with screenshots; v1.0.0.** Before the tag: re-measure the
   board on integrated graphics (D-006 caveat), trim the 900 MB DB (drop the Spellbook `json` column or make printings optional).

Also queued: Trainer "consequence" line per step; decision-point branching (Q-003, if time permits); a real card back asset for the
opponent's face-down hand; storm/blink/tokens templates (patterns exist for go-wide-tokens and voltron without playlines).

## Open risks / unknowns
- **Templates are schematic.** Turn numbers are fixed per template (Commander shifts ramp lines by one turn); damage comes from printed
  power only (no pump math); "[team]" attacks sum the named creatures. The strategy-analyst still wants CMC-aware turn placement.
- **Tracks are static (D-007).** The opponent never reacts; `[placeholder]` cards render as generic tiles. Real names are verified by test.
- **Board FLIP measures DOM rects** after each snapshot; a `ResizeObserver` re-baselines on resize. Untested at 2× DPI and on integrated GPUs.
- **Combo lookups POST decklists to Spellbook** by default; Settings has the switch (Q-014, D-017).
- **DB size** ~900 MB; **CSP** still `null`; perf numbers from an RTX 5070; CR text is 98 days old.

## How to verify things unattended (worked this session)
- **DB:** `cd app/src-tauri && cargo run --release --bin magictrainer-import -- --data ../../data`.
- **App on repo data:** `MAGICTRAINER_DATA_DIR=C:\dev\MagicTrainer\data npm run tauri dev` (in `app/`).
- **Open a screen:** `npx tauri dev --config <json>` with `{"build":{"devUrl":"http://localhost:1420/?<params>"}}`. Params: `route=`, `mode=trainer`,
  `deck=<id>`, `view=graph`, `importFile=<path>`, and for the Trainer `playline=<id>`, `track=<id>`, `pos=<n>`, `autoplay=1`.
- **Screenshot:** `powershell -File scripts/screenshot-window.ps1 -Out shot.png` (waits for a ≥ 400 px window; PrintWindow, no focus needed).
- **Diagnostics / seeding:** `/diag.html?collector=…&autoclose=1`; `?seed=<dir>&files=…` (decks); `?seedCollection=<csv>`.
  Seeded deck ids: `seed-<file-name-with-dashes>` (e.g. `seed-athreos-aristocrats-txt`).
- **Reviews:** `ui-reviewer`, `rules-judge`, `strategy-analyst` subagents were run on the Trainer; their remaining minors are listed above.
- **Tool gotchas:** long Bash heredocs get mangled → write patch scripts to the scratchpad with the Write tool; Python non-raw `\b` writes a
  backspace byte; Python text writes emit CRLF (use `newline=""`); `grep -c` exits 1 on zero matches and breaks `&&` chains; PowerShell
  `PYTHONIOENCODING=utf-8` for any script printing `→`.

## Where things are
- Rust: `app/src-tauri/rust/` — `db.rs`, `import/`, `download.rs`, `net.rs`, `images.rs` (mtimg), `spellbook_api.rs`, `decks.rs`, `collection.rs`, `rules.rs`, `commands.rs`
- Core: `app/src/core/` — parsers, `resolve/`, `strategy/` (14 patterns), `import/`, `export/`, `math/deckStats.ts`, `graph/deckGraph.ts`,
  `opponent/schema.ts` (track Zod), `trainer/{timeline,boardState}.ts`, `trajectory/templates.ts` (8 templates), `links.ts`
- Data: `app/src/data/` — cards, nameIndex, decks, collection, `tracks.ts` (bundled `/opponent-tracks/*.track.json` via import.meta.glob)
- Board: `app/src/board/` — `BoardScene.tsx` (FLIP + SVG arrows), `CardSprite.tsx`, `Timeline.tsx`, `StepPanel.tsx`, `board.module.css`
- UI: `app/src/ui/` — `queries.ts`, `store.ts` (+ `usePrefs`), screens: Decks / DeckAnalysis / StrategyPanel / DeckGraph / Collection /
  Trainer / Data / Rules
- Tracks: `opponent-tracks/*.track.json` (7) · Decisions: D-012…D-018 · Questions: OPEN block empty (all accepted 2026-09-25)
