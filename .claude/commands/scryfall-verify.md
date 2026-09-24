---
description: Verify a card's exact name, Oracle text, mana cost, legalities, or oracle tags against Scryfall before using it in code, tests, tracks, or docs. Use for any specific card reference.
allowed-tools: WebFetch(domain:api.scryfall.com), WebFetch(domain:scryfall.com), Read, Grep
argument-hint: [card name]
---
1. Prefer the local DB if `data/scryfall/` exists (grep the JSONL by `"name":"…"`).
2. Otherwise fetch `https://api.scryfall.com/cards/named?exact=<name>` with headers `User-Agent: MagicTrainer/0.1` and `Accept: application/json`. Max 10 req/s; batch ≥ 5 cards via `POST /cards/collection` (see `knowledge/mtg-data-apis/scryfall/api_cards_collection.md`).
3. Record: `name`, `oracle_id`, `mana_cost`, `type_line`, `oracle_text`, `legalities`, `game_changer`. For tags, use the oracle-tags bulk file (`knowledge/mtg-data-apis/oracle-tag-index.json` lists slugs).
4. Never paraphrase Oracle text into a fixture as if it were real; test stubs must be labelled as stubs.
