# Curated Resource Index (retrieved 2026-09-24)

Links only — copyrighted articles are not copied into this repo. The agent should fetch and
summarize as needed, citing the source. Official WotC rules documents *are* bundled (`../mtg-rules/`).

## Official rules & policy
- Comprehensive Rules (TXT, updated with most sets): https://magic.wizards.com/en/rules
- Tournament rules, IPG, JAR (WPN): https://wpn.wizards.com/en/rules-documents
- Banned & restricted: https://magic.wizards.com/en/banned-restricted-list
- Commander format rules (WotC-stewarded since late 2024; brackets & Game Changers): https://magic.wizards.com/en/formats/commander

## Card data & combos (APIs)
- Scryfall API docs: https://scryfall.com/docs/api — bulk JSONL: https://scryfall.com/docs/api/bulk-data — oracle tags (Tagger): https://scryfall.com/docs/api/tags — search syntax: https://scryfall.com/docs/syntax
  - Rate limit: keep to ≤10 req/s, send a descriptive `User-Agent` and `Accept: application/json`; use bulk files for anything large.
- Commander Spellbook: site https://commanderspellbook.com — API root https://backend.commanderspellbook.com/ — swagger https://backend.commanderspellbook.com/schema/swagger/ — bulk variants https://json.commanderspellbook.com/variants.json.gz — dev docs https://spacecowmedia.github.io/commander-spellbook-backend/ — npm client `@space-cow-media/spellbook-client`. ~80 req/min; credit them in-app.
- MTGJSON (AllPrintings, AtomicCards, AllDeckFiles = every precon decklist, Keywords, CardTypes, SQLite builds): https://mtgjson.com/downloads/all-files/ — docs https://mtgjson.com/data-models/
- EDHREC (archetype/commander data; JSON endpoints are unofficial — respect ToS): https://edhrec.com
- 17Lands (Limited data, public datasets): https://www.17lands.com/public_datasets
- MTGGoldfish metagame: https://www.mtggoldfish.com/metagame — MTGTop8: https://mtgtop8.com — MTGDecks: https://mtgdecks.net
- Moxfield (deck host; export formats): https://www.moxfield.com/help/importing-and-exporting — Archidekt: https://archidekt.com

## Import/export formats
- transmute-mtg format catalogue (bundled README in `../import-formats/`, MIT): https://github.com/oflannabhra/transmute
- ManaBox guide: https://www.manabox.app/guide — TCGplayer collection/bulk entry: https://help.tcgplayer.com/hc/en-us/articles/360056778454
- MTG Arena export: "1 Card Name (SET) 123" lines with `Deck` / `Sideboard` / `Commander` headers.

## Strategy theory (classic articles — fetch & summarize, don't copy)
- Mike Flores, "Who's the Beatdown?" (1999) — role assignment in a matchup.
- Reid Duke, "Level One" series (WotC, 2014–15) — fundamentals: card advantage, tempo, mana, mulligans, combat.
- Frank Karsten, "How many lands/colored sources do you need" series (ChannelFireball/TCGplayer) — hypergeometric land math.
- Patrick Chapin, *Next Level Deckbuilding* (book) — archetype construction.
- Command Zone / EDHREC "deckbuilding template" (8×8, 10-10-10 ratios) — Commander skeletons.
- MTG Wiki (CC BY-NC-SA) archetype and mechanic articles: https://mtg.fandom.com/wiki/Archetype

## Open-source engines & tools worth studying (architecture, not copying)
- Forge (Java rules engine + AI; card scripts in text): https://github.com/Card-Forge/forge
- XMage (Java, full rules engine, thousands of implemented cards): https://github.com/magefree/mage
- Cockatrice (C++/Qt client, no rules enforcement — useful board UX reference): https://github.com/Cockatrice/Cockatrice
- mtgsdk / scryfall-sdk wrappers for TS/Python; `scryfall-sdk` (TS): https://github.com/ChiriVulpes/scryfall-sdk
- Commander Spellbook backend (Django; variant generation engine): https://github.com/SpaceCowMedia/commander-spellbook-backend

## Windows desktop stack docs
- Tauri v2: https://v2.tauri.app — prerequisites https://v2.tauri.app/start/prerequisites/ — SQL plugin https://v2.tauri.app/plugin/sql/ — Windows installer https://v2.tauri.app/distribute/windows-installer/
- React 19: https://react.dev — Vite: https://vite.dev — TypeScript: https://www.typescriptlang.org/docs/
- PixiJS 8 (GPU 2D for the board/arrows): https://pixijs.com/8.x/guides — React Flow / xyflow (node-graph alternative for deck maps): https://reactflow.dev
- Framer Motion: https://motion.dev — Zustand: https://zustand.docs.pmnd.rs — TanStack Query: https://tanstack.com/query — Zod: https://zod.dev — Vitest: https://vitest.dev — Playwright (E2E): https://playwright.dev
- WebView2 runtime: https://developer.microsoft.com/en-us/microsoft-edge/webview2/ — Rust: https://www.rust-lang.org/tools/install
- Claude Code docs (bundled subset in `../dev-resources/claude-code/`): https://code.claude.com/docs/en/overview

## Design references
- Windows 11 design (Fluent 2): https://fluent2.microsoft.design — WCAG 2.2: https://www.w3.org/TR/WCAG22/
- Card frame proportions: Magic cards are 63 × 88 mm (2.5 × 3.5 in), ratio ≈ 0.716.
