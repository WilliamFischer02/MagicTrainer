# MTG Strategy Knowledge — index

Original reference material written for the MagicTrainer agent. Provenance for every file:
**RECALL-class strategic knowledge** (stable theory and well-known archetypes), written 2026-09-24.
It is *not* a substitute for card data: any exact Oracle text, legality, or price must be
verified live against Scryfall / the bundled rules before it is shown to the user.

| File | What it is for |
|---|---|
| `archetype-taxonomy.md` | The archetype vocabulary the detector and UI use. Roles, signals, win patterns, zone signatures. |
| `combo-patterns.md` | Structural shapes of combos (loops, engines, enablers) so detection is *pattern*-based, not name-based. |
| `deckbuilding-fundamentals.md` | Ratios, curves, land counts, consistency math, evaluation heuristics for the Deck Builder mode. |
| `zone-trajectory-signatures.md` | How each archetype "looks" as arrows across the board — the visual grammar for the Trainer. |
| `opponent-archetype-tracks.md` | Generic turn-by-turn scripts for placeholder opponents (source for `/opponent-tracks/*.json`). |
| `RESOURCES.md` | Curated, dated link index: theory articles, data sources, open-source engines to study, tools. |

Rule citations in these files refer to the Comprehensive Rules in `../mtg-rules/` (effective 2026-06-19).
