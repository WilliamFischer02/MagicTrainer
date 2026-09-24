# Architecture Decision Log

Format: `D-###` · date · status · decision · rationale · consequences. Append-only; supersede, don't edit.

- **D-001 · 2026-09-24 · accepted · Tauri 2 over Electron/.NET/Godot.** Native Windows binary with a small footprint, WebView2, MSI/NSIS bundling, Rust for heavy data work (JSONL streaming, SQLite). Matches William's StackAssembler stack. Consequence: Rust + MSVC Build Tools required on the dev box (setup script installs).
- **D-002 · 2026-09-24 · accepted · React 19 + TypeScript + Vite frontend.** William's toolchain; largest ecosystem for the UI layer.
- **D-003 · 2026-09-24 · accepted · Framework-free `core/` module.** All parsing/detection/trajectory logic is pure TS with unit tests; UI and Tauri are adapters. Consequence: core is reusable by StackAssembler or a CLI later.
- **D-004 · 2026-09-24 · accepted · Scryfall bulk JSONL → local SQLite, live API only for singles/images.** Offline-first, respects Scryfall's rate limits and bulk guidance. Note: Scryfall bulk moved to JSONL.gz; oracle tags now ship as bulk.
- **D-005 · 2026-09-24 · accepted · Combos are confirmed against Commander Spellbook, not invented.** Local patterns detect *shapes*; Spellbook variants (zoneLocations + step descriptions) supply the concrete, community-verified lines. Manual combos allowed only when the user marks them.
- **D-006 · 2026-09-24 · proposed · Board renderer = PixiJS 8 under a React HUD.** To be confirmed by the Phase 1 spike against SVG + Framer Motion; decide on measured fps with 150 sprites + 40 arrows. Whichever wins, arrows must be crisp at 2× DPI.
- **D-007 · 2026-09-24 · accepted · Opponent "tracks" are static timelines, never a rules engine or AI.** Keeps scope honest; StackAssembler owns simulation.
- **D-008 · 2026-09-24 · accepted · Detection rationale is mandatory.** Every StrategyMatch stores which tag/regex/Spellbook id fired; the UI can always show "why". Prevents confident nonsense.
