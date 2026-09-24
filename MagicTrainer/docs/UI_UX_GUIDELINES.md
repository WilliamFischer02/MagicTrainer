# UI / UX Guidelines

**Bar:** commercial-quality Windows desktop app. Not a dev tool, not a web dashboard. If a screen
would look at home in a Steam library or Adobe panel, it passes; if it looks like a default admin template, it fails.

## Principles
1. **The board is the hero.** Everything else is chrome. Panels collapse; the board never does.
2. **Every claim is inspectable.** Detected strategy → why. Step → rule. Price → source + date.
3. **Zero dead ends.** Unresolved card? Fixer. Bad CSV? Row-level errors. No data? Download flow.
4. **Fast by default.** Optimistic UI, skeletons, no spinners over 300 ms without progress text.
5. **Respect the cards.** Never blur, stretch, or upscale card art; keep 63:88 proportions; crisp at 2× DPI.

## Visual language (provisional — Q-005)
- Dark "arcane table": felt #101418 base, panel #1A2028, parchment #E9DFC7 text-on-dark, gold accent #C9A227, mana colors from Scryfall's conventional palette (W #F9FAF4, U #0E68AB, B #150B00, R #D3202A, G #00733E).
- Type: Segoe UI Variable (system) for UI; a humanist serif (e.g. "Crimson Pro") for rules quotes.
- Motion: purposeful, ≤ 600 ms, easing out; reduced-motion honored.
- Icons: Fluent System Icons.

## Layout rules
- 8 px grid; 12/16/24 spacing scale; 1440×900 design baseline; min 1100×700.
- Left rail: mode switch (Builder / Trainer), decks, collection, settings. Right panel: context (card, strategy, step).

## Quality gate before any UI task is "done"
- [ ] Screenshot at 1× and 2× DPI reviewed (no blur, no clipped text)
- [ ] Keyboard-only walkthrough works
- [ ] Empty, loading, error, and success states all designed
- [ ] Copy reviewed: precise MTG vocabulary (priority, resolves, dies, exile)
