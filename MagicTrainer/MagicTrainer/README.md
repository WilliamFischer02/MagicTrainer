# MagicTrainer

> Read your real Magic: The Gathering collection and decks, **detect the strategies and combos inside them**,
> and **watch the winning line play out** as card trajectories across a game board — library → hand →
> battlefield → graveyard → back — against scripted opponent tracks. A Windows desktop trainer, not a simulator.

**Status:** Phase 0 bootstrap (2026-09-24). Core parsers + strategy detector are implemented and tested;
the desktop shell is scaffolded; Phase 1 (data spine + board spike) is next. See `docs/ROADMAP.md`.

## Modes
- **Deck Builder** — import a collection (ManaBox / TCGPlayer / Moxfield CSV) and decks; curve, mana, role coverage, detected archetypes and combos with *why*, near-miss combos, upgrades from cards you already own before anything you'd buy.
- **Deck Trainer** — import a deck (same formats + plain/Arena text), pick an opponent track, and step through the animated playline with rules citations and break points.

## Stack
Tauri 2 · React 19 · TypeScript · Vite · SQLite (Scryfall bulk) · PixiJS 8 (board) · React Flow (deck graph) · Zustand · TanStack Query · Zod · Vitest. Details: `docs/ARCHITECTURE.md`.

## Quick start (Windows)
```powershell
# admin PowerShell — installs Git, Node, Rust, MSVC Build Tools, WebView2, Claude Code; clones; tests; fetches data
Set-ExecutionPolicy -Scope Process Bypass -Force
.\scripts\setup-magictrainer.ps1
# then
cd app; npm run tauri dev
```
Run the AI engineer: `powershell -ExecutionPolicy Bypass -File scripts\launch-agent.ps1` (reads `AGENT_STARTUP_PROMPT.md`).

## Layout
```
app/           Tauri + React app; app/src/core = framework-free domain logic (tested)
knowledge/     rules (CR/MTR/JAR/B&R), API docs, strategy theory, import formats, stack docs — read knowledge/KNOWLEDGE_INDEX.md
docs/          brief · architecture · roadmap · decisions · questions-for-William · handoff · specs
opponent-tracks/  scripted placeholder opponents (JSON)
data/samples/  William's six decks + sample CSVs (bulk data is gitignored; scripts/fetch-data.ps1)
scripts/       setup · fetch-data · refresh-rules · launch-agent (PowerShell)
.claude/       agent settings, skills, subagents, path rules
```

## Data & credits
Card data © Scryfall (bulk JSONL + oracle tags from the Tagger community). Combos from
[Commander Spellbook](https://commanderspellbook.com). Precon lists from [MTGJSON](https://mtgjson.com).
Import-format reference from [transmute-mtg](https://github.com/oflannabhra/transmute) (MIT).
Magic: The Gathering © Wizards of the Coast — unofficial fan content under the Fan Content Policy.

## License
MIT — see `LICENSE`.
