# Zone Trajectory Signatures — the visual grammar

The Trainer draws a **board** with the seven zones (CR 400.1: library, hand, battlefield, graveyard,
stack, exile, command) for the user, plus a mirrored, simplified opponent side. Cards are nodes;
**arrows are zone transitions**; **pulses** are effects that don't change zones (triggers, damage,
life change, counters).

## Arrow vocabulary
| Action | From → To | Style |
|---|---|---|
| draw | library → hand | thin, neutral |
| tutor | library → hand (or battlefield) | dashed, labeled "search" |
| cast | hand → stack | solid, mana cost badge |
| resolve | stack → battlefield (permanent) / stack → graveyard (instant/sorcery) | solid |
| countered / fizzle | stack → graveyard | red X |
| dies / destroy / sacrifice | battlefield → graveyard | red; "sacrifice" gets a sac-outlet badge |
| reanimate / return | graveyard → battlefield / hand | green, glowing |
| exile | any → exile | grey |
| blink | battlefield → exile → battlefield | looped arrow |
| attack | battlefield → opponent (life) | orange, damage number |
| trigger | node pulse | ring animation on the source, labeled |
| life change | player HUD | number ticks |

## Archetype signatures (what the user should recognize at a glance)
- **Aristocrats:** tight battlefield↔graveyard cycles with payoff pulses each cycle. The "engine" is visible as a loop.
- **Reanimator:** a long arrow that skips the stack: hand→graveyard, then graveyard→battlefield with a "cheat" badge showing mana saved.
- **Ramp/Stompy:** early library→battlefield land arrows (ramp), then one thick hand→stack→battlefield arrow for a huge threat, then attack fans.
- **Prowess/Tempo:** rapid hand→stack→graveyard churn with pulses on creatures each cast; attack arrows same turn.
- **Control:** opponent's arrows get intercepted (counter: stack→graveyard); sweepers send many opponent battlefield nodes to graveyard at once.
- **Voltron:** many arrows terminate on one battlefield node; its attack arrow grows each turn; commander damage counter in HUD.
- **Tokens:** one source node fans out to many token nodes; anthem pulses ripple across all.
- **Storm/Spellslinger:** storm count HUD; each cast draws a pulse on every payoff.
- **Blink:** short battlefield→exile→battlefield loops with ETB pulses.

## Timeline model
- A `Playline` is a list of `TrajectoryStep`s each stamped with `turn` and `phase` (CR 500.1).
- The scrubber shows turns as major ticks and phases as minor ticks; the opponent track's events are interleaved by turn/phase so the user sees *why* the line is sequenced (e.g. cast the payoff before the sweeper turn).
- Every step exposes: mana spent, cards in hand after, life totals, and a one-line "why" with a CR citation where useful.
- Steps can carry **break points**: "If the opponent has removal here, the loop stops — hold priority and respond with…". These are the training payload.

## Rendering constraints (Windows, commercial quality)
- 60 fps target; arrows are GPU-drawn (PixiJS in a `<canvas>` layered under a React HUD, or SVG with Framer Motion if node counts stay < 200 — decide in Phase 1 spike and record in DECISIONS.md).
- Card art from Scryfall image URIs, cached to disk under the app data directory; respect Scryfall's image usage guidelines and rate limits (10 requests/sec max; bulk downloads via bulk data, never scraping).
- High-DPI: render at devicePixelRatio; never blur card art (William's standing rule for visual assets).
- Reduced-motion setting honors `prefers-reduced-motion`.
