# Import / Export Formats

Verified 2026-09-24 (headers from the transmute-mtg catalogue and live exports; see `knowledge/import-formats/`).
**Always match CSV columns by header name, never position.** ManaBox omits columns depending on export settings.

| Format | Detection | Key columns | Notes |
|---|---|---|---|
| ManaBox CSV | has `Set code` + `Collector number` + `Quantity` + `Name` | `Name, Set code, Set name, Collector number, Foil, Rarity, Quantity, ManaBox ID, Scryfall ID, Purchase price, Misprint, Altered, Condition, Language, Purchase price currency` | `Foil` = `foil`/`etched`/empty; `Scryfall ID` = printing id (best key). Conditions lowercase snake (`near_mint`). |
| TCGPlayer CSV | has `Simple Name` or `Product ID`+`SKU` | `Quantity, Name, Simple Name, Set, Card Number, Set Code, Printing, Condition, Language, Rarity, Product ID, SKU` | Use `Simple Name`; `Name` carries variant text. `Printing` = `Normal`/`Foil`. `Set Code` uppercase. |
| Moxfield CSV | has `Count` + `Edition` | `Count, Tradelist Count, Name, Edition, Condition, Language, Foil, Alter, Proxy, Purchase Price, Collector Number` | `Edition` lowercase set code. |
| Decklist text | lines `N Card` / `Nx Card`, headers `Commander/Deck/Sideboard/Maybeboard`, `SB:` prefix, `//` comments | — | Moxfield/Archidekt/TCGplayer/MTGO text. |
| MTG Arena text | lines `N Card (SET) 123` | — | Set code + collector number resolve to a printing. `Commander` header supported. |
| Deckbox / DragonShield / Archidekt / MTGO CSV | see transmute catalogue | — | Phase 2+ |

## Export (Phase 2)
- Decklist text (Moxfield dialect with `Commander`/`Deck`/`Sideboard`), Arena dialect (with set/CN when known).
- ManaBox-compatible CSV for a deck's card list (so William can create a ManaBox list from a brew).

## Error policy
Every unparsable row → `errors[]` with row number + reason; unresolved card names → an interactive
fixer (autocomplete from FTS) before anything is saved. Never silently drop a line.
