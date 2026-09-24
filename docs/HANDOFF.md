# Session Handoff

The agent rewrites this file at the end of every session (and every ~2 hours of unattended work).
It is the first thing the next session reads after CLAUDE.md.

## Last session
- **Date:** 2026-09-24 · **By:** repo bootstrap (Claude, chat) · **Duration:** n/a
- **State:** Phase 0 complete except Windows build verification. 21 core tests pass (`npm test` in `app/`). Tauri scaffold untested on Windows.

## Next 3 actions (in order)
1. Run `scripts/setup-magictrainer.ps1` prerequisites check → `cd app && npm install && npm run tauri dev`; fix anything the scaffold needs (Cargo resolution, WebView2). Commit "chore: verify scaffold builds on Windows".
2. Phase 1 · Rust bulk-import command (Scryfall JSONL.gz → SQLite) with progress events + `scripts/fetch-data.ps1` parity.
3. Phase 1 · Board rendering spike (PixiJS vs SVG) → DECISIONS.md D-006 resolution.

## Open risks / unknowns
- `create-tauri-app` scaffolded with `typescript ~6` and `vite ^8`; confirm `tsc && vite build` passes on Windows.
- Scryfall bulk format is JSONL.gz (changed from JSON); make sure the Rust importer streams, never loads whole file.
- Oracle-tag coverage varies by card; regex fallbacks must stay conservative (see D-008).

## Where things are
- Domain types: `app/src/core/types.ts` · Patterns: `app/src/core/strategy/patterns.ts` · Templates: `app/src/core/trajectory/templates.ts`
- Questions for William: `docs/QUESTIONS_FOR_WILLIAM.md` (12 open, all with provisional answers)
