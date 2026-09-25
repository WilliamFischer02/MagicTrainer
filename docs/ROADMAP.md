# Roadmap

Phases are checklists. The agent updates this file at the end of every session (see HANDOFF.md).
"Done" means: implemented, tested, documented, and demoable.

## Phase 0 — Foundation (this repo drop) ✅ partially
- [x] Repo scaffold (Tauri 2 + React 19 + TS + Vite), core domain types
- [x] Parsers: decklist text (plain/Arena/MTGO), ManaBox CSV, TCGPlayer CSV, Moxfield CSV — 21 unit tests
- [x] Strategy patterns v0 (8 archetypes/combos) + detector + 3 playline templates
- [x] Knowledge pack (rules, API docs, strategy theory, dev docs), sample decks, 2 opponent tracks
- [x] Agent config (CLAUDE.md, skills, subagents, hooks), setup + data scripts
- [x] Verify the scaffold builds on Windows (`npm run tauri dev`) — verified 2026-09-24: `cargo check` 60 s, dev window opened (Rust 1.97.1, Node 24, WebView2 153)

## Phase 1 — Data spine ✅ (2 leftovers below are Phase 3/4 wiring)
- [x] Rust command: download Scryfall bulk (oracle-cards, rulings, oracle-tags) with progress; stream JSONL.gz → SQLite; schema + migrations; FTS5 name index — `import_bulk` + `magictrainer-import` CLI; 38,690 cards / 236k taggings / 79k rulings in 27 s (debug)
- [x] Card resolver (exact → normalized → fuzzy with confidence; DFC/split/adventure names) — `core/resolve/`, 51 tests
- [x] `data/` TS layer (DbClient, card queries with Zod, NameIndex loader, deck resolution) — six sample decks resolve with 0 unresolved
- [x] TanStack Query hooks; card image disk cache with Scryfall rate limiting (≤10 rps, User-Agent) — `ui/queries.ts`, `mtimg` protocol + `rust/images.rs` (D-012, D-014); verified in WebView2 via `app/diag.html`
- [x] Commander Spellbook bulk variants import (streaming visitor, D-011)
- [x] `find-my-combos` client with on-disk cache (default path per Q-013) — `rust/spellbook_api.rs` + `core/strategy/spellbook.ts` (D-013), 24 h TTL, stale-on-offline
- [x] Board rendering spike: PixiJS vs SVG+Motion — D-006 resolved: React DOM + SVG + Motion (both 60 fps at 10× load in WebView2)
- [x] Design tokens + typography + "arcane table" theme; app shell (nav, mode switch, settings) — `app/src/ui/`, rules viewer + data/settings screens live
- [x] Rules viewer: link rule citations in step notes — `StepPanel` citation buttons open the context panel via `rules_get` (2026-09-25); glossary cross-links still open
- [ ] ESLint + `no-restricted-imports` dependency-direction rule (eslint is not installed; `npm run lint` fails)
- [ ] UI review minors (2026-09-24): fold DataScreen inline token styles into CSS modules (partly done: `.lede`); `--measure-*` tokens for 640/860/900 px widths; 2× DPI screenshot pass on a HiDPI display

## Phase 2 — Deck Builder MVP ✅ (2026-09-25; polish items tracked inline)
- [x] Import UI (drag-drop, format auto-detect, error report, unresolved-name fixer with autocomplete) — 2026-09-24, `DecksScreen.tsx`; six sample decks import with 0 unresolved
- [x] Collection view (art-tile grid, search, color-identity/type filters, sort by qty/price/MV; replace/append import with printing-level matching) — `CollectionScreen.tsx`, `data/collection.ts`, `rust/collection.rs`; list view + tag filter UI still open
- [x] Deck view: curve histogram, color sources vs pips, role coverage vs baseline, legality check — `core/math/deckStats.ts` (19 tests) + `DeckAnalysis.tsx`; commander art hero via `mtimg`
- [x] Strategy panel: detected archetypes/combos with rationale + near-miss suggestions (Card Kingdom search link + cheapest-printing price) — `StrategyPanel.tsx`; 14 patterns, golden tests on the six decks pass; "owned first" waits for the collection import
- [x] Deck graph (React Flow 12): cards as nodes with art, strategy-role hubs, Spellbook combo clusters; deterministic core layout (`core/graph/deckGraph.ts`, 4 tests); hub cap selector — `DeckGraph.tsx`
- [x] Export: decklist text (Moxfield/Arena/MTGO dialects) — `core/export/decklist.ts` (round-trip tested), copy + save dialog on the deck hero

## Phase 3 — Deck Trainer MVP ✅ (2026-09-25; schematic templates, static tracks — see D-018)
- [x] Board scene: 7 zones per side, card sprites (art crop), zone counters, life/mana HUD — `app/src/board/BoardScene.tsx` (FLIP moves + SVG arrows, D-006)
- [x] Playline engine: merge user playline + opponent track by (turn, phase); scrubber; play/pause/step; speed — `core/trainer/{timeline,boardState}.ts`, `board/Timeline.tsx`
- [x] Arrow/pulse renderers per `zone-trajectory-signatures.md`; reduced-motion mode — arrow kinds (draw/cast/remove/return/exile/attack), trigger pulses, ghost trails; `prefers-reduced-motion` → 0 ms
- [x] Step panel: why (CR citation → opens rules viewer), mana/cards/life ledger, break points — `board/StepPanel.tsx`
- [x] Opponent track loader + validator; 5 more tracks (bg-midrange, combo-storm, edh-precon-value, edh-stax, edh-graveyard-hate) — `core/opponent/schema.ts`, `data/tracks.ts`; real card names verified against the DB by test
- [x] Rules viewer: search the bundled CR sections by rule number/keyword — `RulesScreen` (Phase 1) + citation jump from the Trainer step panel

## Phase 4 — Polish & ship
- [ ] Onboarding + first-run data download flow; offline mode
- [ ] Accessibility pass (keyboard nav, contrast, screen-reader labels on HUD)
- [ ] Playwright E2E on the built app; crash reporting (local log)
- [ ] `tauri build` MSI/NSIS; auto-update decision; README with screenshots; v1.0.0 tag

## Later / ideas parking lot
- Custom opponent tracks authored from a real decklist (semi-automatic)
- Sideboard plans per opponent track
- Limited (draft) mode using 17Lands data
- Share/export a playline as a video/GIF or PDF "play sheet" (fits William's booklet habit)
- Import from MTGA Player.log (William has prior tooling)
