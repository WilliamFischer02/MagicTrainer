# Architecture

## Stack (decided 2026-09-24 — see DECISIONS.md D-001…D-006)
| Layer | Choice | Why |
|---|---|---|
| Shell | **Tauri 2** (Rust) | Native Windows binary, tiny footprint, WebView2 rendering, MSI/NSIS bundling; same stack as William's StackAssembler → shared know-how |
| UI | **React 19 + TypeScript + Vite** | William's established toolchain |
| State | **Zustand** (app state) + **TanStack Query** (async data) | Small, testable, no boilerplate |
| Board rendering | **PixiJS 8** in a canvas beneath a React HUD (Phase 1 spike also evaluates SVG + Framer Motion) | GPU-accelerated arrows/particles at 60 fps; React for panels/text |
| Deck-graph view | **@xyflow/react** (React Flow) | Node/edge graph of card relationships in Deck Builder |
| Local DB | **SQLite** via `tauri-plugin-sql` (rusqlite) | Card DB from Scryfall JSONL; FTS5 for name search; offline-first |
| Validation | **Zod** | Every import/JSON boundary |
| Parsing | **PapaParse** (CSV) + hand-written decklist grammar | |
| Tests | **Vitest** (unit, core), **Playwright** (E2E on the built app, later), Rust `cargo test` | |
| Styling | CSS Modules or Tailwind 4 (decide in Phase 1) + design tokens file | Fluent-2-informed dark "arcane table" theme |
| Packaging | `tauri build` → MSI + NSIS; optional code signing later | |

## Module layout
```
app/
  src/
    core/            # framework-free domain logic (NO React/Tauri imports). Unit-tested.
      types.ts       # Card, Deck, CollectionEntry, StrategyMatch, TrajectoryStep, Playline, OpponentTrack
      parsers/       # decklist text, ManaBox/TCGPlayer/Moxfield CSV, format detection
      strategy/      # pattern definitions (roles), detector, near-miss finder
      trajectory/    # playline templates → TrajectoryStep[]; Spellbook description → steps
      opponent/      # track schema (zod) + loader          (to do)
      math/          # hypergeometric, curve stats           (to do)
    data/            # card DB access layer over tauri-plugin-sql; Scryfall/Spellbook clients (to do)
    ui/              # React: screens, HUD, panels, design tokens                          (to do)
    board/           # PixiJS scene: zones, card sprites, arrow/pulse renderers, timeline  (to do)
    bridge/          # Tauri invoke wrappers (fs, dialog, http, store)                     (to do)
  src-tauri/         # Rust crate. Sources are in src-tauri/rust/ (NOT src/ — Cargo paths set in Cargo.toml) — commands (bulk import → SQLite, image cache), plugins, capabilities
knowledge/           # read-only reference pack (rules, API docs, strategy, dev docs)
opponent-tracks/     # JSON tracks
data/                # samples committed; bulk data gitignored
docs/                # this folder: brief, roadmap, decisions, specs, handoff, questions
scripts/             # PowerShell: setup, fetch-data, refresh-rules, launch-agent
.claude/             # agent config: settings, skills, subagents, rules
```

## Dependency rule
`core` ← `data` ← `ui`/`board` ← `bridge`. Core never imports upward. Enforce with an ESLint
`no-restricted-imports` rule in Phase 1.

## Data flow
1. First run: `fetch bulk` command (Rust) streams Scryfall `oracle-cards` JSONL.gz → SQLite `cards`
   table (+ `oracle_tags` join table from the tags bulk file, + `rulings`). Progress events to UI.
2. Import: file → parser → `Deck`/`CollectionEntry[]` → resolve names against SQLite (exact, then
   normalized: strip diacritics, handle split/DFC "A // B", "Legendary Creature" quirks) → unresolved list shown.
3. Detect: `resolveDeck` → `detectStrategies` (local patterns) ∪ Spellbook `find-my-combos` (cached) → `StrategyMatch[]`.
4. Build playlines: template or Spellbook steps → `Playline`.
5. Render: board scene consumes `Playline` + `OpponentTrack` → timeline merge by (turn, phase) → animation.

## Performance budgets
- Cold start ≤ 2 s to interactive (DB opened lazily). Deck import + detection ≤ 300 ms for 100 cards.
- Board: ≤ 16 ms/frame with 150 card sprites + 40 live arrows. Image cache on disk (`%LOCALAPPDATA%\MagicTrainer\cache\images`).

## Security / capabilities (Tauri)
Enable only: `fs` (app data + user-picked files via dialog), `dialog`, `http` (scryfall.io, api.scryfall.com,
cards.scryfall.io, backend.commanderspellbook.com, json.commanderspellbook.com, mtgjson.com), `sql`, `store`, `opener`.
CSP configured (no `null` in production). See `knowledge/dev-resources/tauri/tauri_security_capabilities.md`.
