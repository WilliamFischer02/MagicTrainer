# Sample data

- `decks/*.txt` — William's six real decklists (from the ARCHIVIST player profile, 2026-07-03) in the
  interchange text format the app must parse (`Commander` / `Deck` sections, `// comments`).
  `mono-blue-affinity.txt` is a *designed* list; the purchase was never confirmed.
- `collections/*.csv` — synthetic rows in the exact **ManaBox** and **TCGPlayer** header layouts.
  Scryfall IDs in the ManaBox sample are placeholders and will not resolve; real exports will.
- Bulk card data is never committed. Run `scripts/fetch-data.ps1`.
