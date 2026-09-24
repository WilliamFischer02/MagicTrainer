# MagicTrainer — Project Brief

**Owner:** William Fischer (Goob Entertainment Co.) · **Repo:** https://github.com/WilliamFischer02/MagicTrainer
**Platform:** Windows desktop (Windows 10 1809+/11), commercial-quality UI · **Started:** 2026-09-24

## One-sentence pitch
A Windows app that reads your real MTG collection and decks, **detects the strategies and combos
inside them**, and **animates the winning line as card trajectories across a game board** — from
library to hand to battlefield to graveyard and back — against scripted placeholder opponents, so you
learn to *see* how your deck wins before you sit down to play.

## What it is / isn't
- It **is** a visualizer and trainer: deck analysis, strategy/combo detection, step-by-step animated
  playlines with rules citations and decision points, opponent "tracks" for realistic pacing.
- It **is not** a rules engine or a game simulator. No opponent AI. Tracks are pre-built timelines.
  (StackAssembler, William's other project, is the simulator lane — keep the boundary clean.)

## Two modes
1. **Deck Builder** — imports a *collection* (ManaBox / TCGPlayer / Moxfield CSV) and decks; shows role
   coverage, curve, mana, detected archetypes/combos, near-miss combos, owned-card upgrades before
   purchases, budget vs. optimal lines. Exports decks in the same text formats it imports.
2. **Deck Trainer** — takes a *deck* (same formats), runs detection, builds playlines, and plays them
   back on the board with a turn/phase scrubber against a chosen opponent track. Each step shows
   mana/cards/life, the "why" (CR citation), and break points (what interaction stops the line).

## Unified I/O
Collections and decks share one parser layer (`app/src/core/parsers`). Anything the Builder reads,
the Trainer reads. Supported on day one: ManaBox CSV, TCGPlayer CSV, Moxfield CSV, plain decklist
text (`1 Card Name`), MTG Arena export text. More formats via the transmute-mtg catalogue.

## Data sources
- Scryfall bulk JSONL (oracle cards, rulings, **oracle tags**) → local SQLite. Live API only for
  single-card refresh, images, and prices (never bulk over the API).
- Commander Spellbook bulk variants + `find-my-combos` for combo confirmation.
- MTGJSON `AllDeckFiles` for precon lists (seed decks and opponent tracks).
- Comprehensive Rules bundled in `knowledge/mtg-rules/` for citations.

## Non-goals (v1)
Online play, rules enforcement, AI opponent, mobile, price arbitrage, MTGA integration beyond text export.

## Success criteria for v1.0
- [ ] Import William's six real decks + a real ManaBox export without manual fixes.
- [ ] Detect: Athreos = aristocrats + drain loop; Ghalta = ramp/stompy; Purple = prowess tempo;
      Pink = Boros aggro; Stompy = mono-green stompy; Affinity = artifact aggro — with rationales.
- [ ] Animate the Athreos aristocrats loop and the Exquisite/Sanguine drain against `uw-control` and
      `mono-red-aggro` tracks with correct turn/phase pacing and CR-cited notes.
- [ ] 60 fps board animation at 1440×900 on an average Windows laptop; crisp card art at 2× DPI.
- [ ] Signed-or-unsigned MSI/NSIS installer builds via `tauri build`; first run downloads bulk data
      with a progress UI and works offline afterwards.
- [ ] Zero crashes on malformed imports; every parser error is shown, never swallowed.
