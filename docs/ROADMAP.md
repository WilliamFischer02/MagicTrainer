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

## Phase 1 — Data spine (target: 1–2 unattended sessions)
- [x] Rust command: download Scryfall bulk (oracle-cards, rulings, oracle-tags) with progress; stream JSONL.gz → SQLite; schema + migrations; FTS5 name index — `import_bulk` + `magictrainer-import` CLI; 38,690 cards / 236k taggings / 79k rulings in 27 s (debug)
- [x] Card resolver (exact → normalized → fuzzy with confidence; DFC/split/adventure names) — `core/resolve/`, 51 tests
- [x] `data/` TS layer (DbClient, card queries with Zod, NameIndex loader, deck resolution) — six sample decks resolve with 0 unresolved
- [ ] TanStack Query hooks; card image disk cache with Scryfall rate limiting (≤10 rps, User-Agent)
- [x] Commander Spellbook bulk variants import (streaming visitor, D-011)
- [ ] `find-my-combos` client with on-disk cache (default path per Q-013)
- [x] Board rendering spike: PixiJS vs SVG+Motion — D-006 resolved: React DOM + SVG + Motion (both 60 fps at 10× load in WebView2)
- [ ] Design tokens + typography + "arcane table" theme; app shell (nav, mode switch, settings)

## Phase 2 — Deck Builder MVP
- [ ] Import UI (drag-drop, format auto-detect, error report, unresolved-name fixer with autocomplete)
- [ ] Collection view (grid/list, search, filters by color/type/tag/owned qty)
- [ ] Deck view: curve histogram, color sources vs pips, role coverage vs baseline, legality check
- [ ] Strategy panel: detected archetypes/combos with rationale + near-miss suggestions (owned first, then Card Kingdom link/price)
- [ ] Deck graph (React Flow): cards as nodes, role edges, combo clusters
- [ ] Export: decklist text (Moxfield/Arena dialects)

## Phase 3 — Deck Trainer MVP
- [ ] Board scene: 7 zones per side, card sprites (art crop), zone counters, life/mana HUD
- [ ] Playline engine: merge user playline + opponent track by (turn, phase); scrubber; play/pause/step; speed
- [ ] Arrow/pulse renderers per `zone-trajectory-signatures.md`; reduced-motion mode
- [ ] Step panel: why (CR citation → opens rules viewer), mana/cards/life ledger, break points
- [ ] Opponent track loader + validator; 5 more tracks (bg-midrange, combo-storm, edh-precon-value, edh-stax, edh-graveyard-hate)
- [ ] Rules viewer: search the bundled CR sections by rule number/keyword

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
