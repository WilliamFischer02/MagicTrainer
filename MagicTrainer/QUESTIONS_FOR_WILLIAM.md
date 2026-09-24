# Questions for William — batched

**Protocol (agent):** Never stop work to ask a question. Add it here with an ID, context, the options
you see, and your *provisional decision* — then proceed on the provisional decision and mark the affected
code/docs with `// Q-###`. At the end of a session (or when ≥ 5 open questions accumulate, or a question
blocks a whole phase), present the OPEN block to William in one message, grouped by topic, each with a
recommended answer so he can reply "accept all" or override by ID. Move answered items to RESOLVED with
the date and update any `// Q-###` markers.

## OPEN

### Product
- **Q-001 · Board view perspective.** Overhead "table" view (both players' zones visible, arrows travel across the table) vs. a "your side + opponent summary strip"? Options: A) full table, B) split with opponent strip, C) toggle. **Provisional: C**, default A for Commander, B for 60-card.
- **Q-002 · Commander opponents.** Represent three opponents as one aggregated "table" side, or three mini-sides? **Provisional: aggregated side with a 3-slot life HUD** (v1); mini-sides later.
- **Q-003 · Trainer interactivity.** Purely playback (scrub/step) in v1, or allow the user to choose between alternative lines at decision points? **Provisional: playback + branching at marked decision points if time permits in Phase 3.**
- **Q-004 · Price source.** Card Kingdom is the preferred vendor but has no public API; Scryfall `prices.usd` is TCGplayer market. Show Scryfall prices with a "Buy on Card Kingdom" link via `purchase_uris.cardkingdom`? **Provisional: yes.**

### Visual identity
- **Q-005 · Theme.** Dark "arcane table" (deep navy/charcoal felt, warm gold accents, parchment panels) vs. clean light Fluent? **Provisional: dark arcane with a light option later.** Any Goob Entertainment brand assets to reuse?
- **Q-006 · Card imagery.** Full card images vs. art crops on the board (art crops are far more legible at sprite size). **Provisional: art crops on the board, full card on hover/side panel.**

### Data & scope
- **Q-007 · Formats to enforce in v1.** Commander + Modern only (William's decks) or all Scryfall formats? **Provisional: legality for all Scryfall formats is free; deck-size/singleton validation for Commander, Modern, Standard, Pioneer, Legacy, Vintage, Pauper.**
- **Q-008 · Should the app manage the ManaBox collection (edit quantities) or stay read-only?** **Provisional: read-only import in v1; ManaBox stays the source of truth.**
- **Q-009 · Commander brackets / Game Changers.** Show WotC bracket estimate for Commander decks (using Scryfall `game_changer` + Spellbook bracket buckets)? **Provisional: yes, labeled "estimate".**

### Engineering
- **Q-010 · Code signing.** Do you have/want a Windows code-signing cert for the installer? Unsigned MSI triggers SmartScreen. **Provisional: unsigned for now; document the warning.**
- **Q-011 · Telemetry/crash reports.** Local log file only, or opt-in upload? **Provisional: local only.**
- **Q-012 · Repo hygiene.** Conventional Commits + a `CHANGELOG.md`? Branch-per-phase with PRs, or commit to `main`? **Provisional: Conventional Commits, feature branches merged to `main` by the agent after tests pass.**

## RESOLVED
_(none yet)_
