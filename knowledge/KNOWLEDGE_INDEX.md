# Knowledge Pack — index & provenance

Everything here is read-only reference material for the MagicTrainer agent. Each subfolder
states its source, license, and retrieval date. **Stale data is worse than no data**: dates are
in filenames or headers; anything live (card text, legality, prices, meta) is verified online.

| Folder | Contents | Source / license | As of |
|---|---|---|---|
| `mtg-rules/` | Comprehensive Rules (full + 10 section files: S1–S9 + glossary), Magic Tournament Rules (TXT), JAR, IPG index (pointers), all-format banned/restricted list, legacy RC Commander rules note | Wizards of the Coast official documents (reproduced for reference) | CR 2026-06-19 · MTR 2026-02-27 · B&R 2026-07-03 |
| `mtg-data-apis/scryfall/` | Scryfall API docs converted to Markdown (overview, cards, named, collection, search, sets, rulings, bulk data (JSONL), tags, images, layouts, rate limits, syntax) + a sample card JSON | scryfall.com/docs (Scryfall) | 2026-09-24 |
| `mtg-data-apis/oracle-tag-index.json` | Index of all 4,559 Scryfall Tagger **oracle tags** (id, slug, label, description, parents, card count). Taggings stripped — re-download the bulk file for card↔tag mappings | Scryfall Tagger community data via bulk export | 2026-09-24 |
| `mtg-data-apis/commander-spellbook/` | API & bulk-data docs (Markdown) + one sample variant JSON | spacecowmedia.github.io / backend.commanderspellbook.com | 2026-09-24 |
| `mtg-data-apis/mtgjson/` | MTGJSON file catalogue (AllPrintings, AtomicCards, AllDeckFiles, Keywords, CardTypes, SQLite…) | mtgjson.com | 2026-09-24 |
| `mtg-strategy/` | **Original** archetype taxonomy, combo pattern shapes, deckbuilding fundamentals, zone-trajectory visual grammar, opponent track designs, curated link index | Written for this project (RECALL-class theory; not card data) | 2026-09-24 |
| `import-formats/` | transmute-mtg README (exact CSV headers for ManaBox, TCGPlayer, Moxfield, Deckbox, DragonShield, Archidekt, MTGO…) + its ManaBox/TCGPlayer parser sources as reference | github.com/oflannabhra/transmute — MIT (license file included) | 2026-09-24 |
| `dev-resources/tauri/` | Tauri v2 docs (Markdown): prerequisites, create-project, SQL/FS/dialog/HTTP/store plugins, calling Rust, state, capabilities, Windows installer | v2.tauri.app (MIT/Apache docs) | 2026-09-24 |
| `dev-resources/claude-code/` | Claude Code docs: setup, settings, skills, hooks guide, memory (CLAUDE.md), `/goal`, agent teams, sub-agents, headless, permission modes, auto mode, best practices | code.claude.com/docs | 2026-09-24 |

## Bulk datasets (NOT committed — fetch with `scripts/fetch-data.ps1`)
- Scryfall `oracle-cards` JSONL (~23 MB gz), `rulings`, `oracle-tags` → `data/scryfall/`
- Commander Spellbook `variants.json.gz` (~28 MB) → `data/spellbook/`
- MTGJSON `AllDeckFiles.zip` (every precon decklist) and `Keywords.json` → `data/mtgjson/`

## Refreshing
- Rules: `scripts/refresh-rules.ps1` (re-downloads CR/MTR/B&R, re-splits the CR, stamps dates).
- Data: `scripts/fetch-data.ps1` (idempotent; keeps a `manifest.json` with URLs, sizes, dates).
