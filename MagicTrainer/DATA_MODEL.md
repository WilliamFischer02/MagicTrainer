# Data Model

Source of truth: `app/src/core/types.ts`. This document explains intent and the SQLite schema.

## Entities
- **CardOracle** — one row per Oracle ID (functional card). Holds oracle text, types, MV, colors, keywords, legalities, **oracleTags[]**, edhrec rank, game_changer, a representative printing + image URIs.
- **CardPrinting** (Phase 1) — one row per Scryfall card id (set, collector number, finishes, prices snapshot, image URIs). Needed to map collection rows (which are printings) to oracle cards.
- **CollectionEntry** — an owned printing with quantity/foil/condition; keeps the raw import row.
- **Deck** — commanders / main / sideboard / extra sections of `DeckEntry` (name, qty, optional set hints, resolved oracleId).
- **StrategyMatch** — pattern id, confidence, `roles: {roleId: cardNames[]}`, rationale, optional external ref (Spellbook variant id).
- **Playline** — ordered `TrajectoryStep[]` for one strategy in one deck; steps carry (turn, phase, from, to, action, causedBy, note).
- **OpponentTrack** — archetype timeline of opponent `TrajectoryStep`s per turn with board summaries.

## Zones (CR 400.1)
`library | hand | battlefield | graveyard | stack | exile | command`. Arrows are zone pairs; a "pulse"
is a step whose `from === to` (trigger, damage, counters, life change).

## SQLite schema (Phase 1 target)
```sql
CREATE TABLE cards (
  oracle_id TEXT PRIMARY KEY, name TEXT NOT NULL, name_norm TEXT NOT NULL, mana_cost TEXT, cmc REAL,
  type_line TEXT, oracle_text TEXT, colors TEXT, color_identity TEXT, keywords TEXT, power TEXT, toughness TEXT,
  loyalty TEXT, legalities_json TEXT, edhrec_rank INTEGER, game_changer INTEGER, layout TEXT,
  repr_printing_id TEXT, image_small TEXT, image_normal TEXT, image_art_crop TEXT, updated_at TEXT
);
CREATE VIRTUAL TABLE cards_fts USING fts5(name, content='cards', content_rowid='rowid');
CREATE TABLE printings (
  id TEXT PRIMARY KEY, oracle_id TEXT REFERENCES cards(oracle_id), set_code TEXT, set_name TEXT, collector_number TEXT,
  rarity TEXT, finishes TEXT, price_usd REAL, price_usd_foil REAL, image_normal TEXT, image_art_crop TEXT, released_at TEXT
);
CREATE INDEX idx_printings_set_cn ON printings(set_code, collector_number);
CREATE TABLE oracle_tags (id TEXT PRIMARY KEY, slug TEXT, label TEXT, description TEXT, parent_ids TEXT);
CREATE TABLE card_oracle_tags (oracle_id TEXT, tag_id TEXT, weight TEXT, PRIMARY KEY (oracle_id, tag_id));
CREATE TABLE rulings (oracle_id TEXT, published_at TEXT, comment TEXT);
CREATE TABLE spellbook_variants (id TEXT PRIMARY KEY, identity TEXT, json TEXT, updated_at TEXT);
CREATE TABLE spellbook_variant_cards (variant_id TEXT, oracle_id TEXT, zone_locations TEXT, PRIMARY KEY (variant_id, oracle_id));
CREATE TABLE decks (id TEXT PRIMARY KEY, name TEXT, format TEXT, source_format TEXT, raw TEXT, created_at TEXT, updated_at TEXT);
CREATE TABLE deck_entries (deck_id TEXT, section TEXT, name TEXT, quantity INTEGER, set_code TEXT, collector_number TEXT, oracle_id TEXT);
CREATE TABLE collection (id INTEGER PRIMARY KEY, printing_id TEXT, name TEXT, set_code TEXT, collector_number TEXT, quantity INTEGER, foil INTEGER, condition TEXT, language TEXT, source_format TEXT, raw_json TEXT, imported_at TEXT);
CREATE TABLE meta (key TEXT PRIMARY KEY, value TEXT); -- bulk file timestamps, schema version
```

## Name normalization (resolver)
`name_norm` = NFKD, strip diacritics, lowercase, collapse whitespace, strip trailing " (SET) 123", map
"A // B" ⇄ "A" for split/DFC/adventure/MDFC (store both faces' names in `name_norm` alternates table if needed).
