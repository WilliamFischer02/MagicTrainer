# Opponent Archetype Tracks — placeholder opponent scripts

Tracks are **timelines, not AIs**. Each is a generic, plausible sequence of plays for an archetype
so the user's playline can be shown *against* something realistic. They live as JSON in
`/opponent-tracks/` (schema: `OpponentTrack` in `app/src/core/types.ts`). Card names in tracks
should be real, format-legal cards verified against Scryfall; where a track is deliberately
generic, use role labels ("2-power haste creature") and let the UI render a placeholder card.

## Track catalogue (v1 targets)

| Id | Archetype | Turns 1–3 | Turns 4–6 | Turns 7+ | Teaches |
|---|---|---|---|---|---|
| `mono-red-aggro` | Aggro | 1-drop, 2-drop haste, burn face | more creatures, burn to clear blockers | burn to finish | Beatdown role, racing math, when to block |
| `uw-control` | Control | lands, cantrip, hold up counter | sweeper on T4, counter the big spell, draw engine | 1 finisher, protect it | Playing around counters/sweepers; sequencing threats |
| `bg-midrange` | Midrange | discard spell, 2-drop | removal on your best threat, 4-drop value | planeswalker, grind | Threat sequencing; baiting removal |
| `combo-storm` | Combo | cantrips, rituals | attempt to combo T4 | – | Interaction timing; when to hold counters |
| `edh-precon-value` | Commander midrange | ramp, commander T3–4 | value engines, one removal per turn | board stall, occasional wrath | Politics-free baseline for Commander lines |
| `edh-stax` | Stax | tax piece T2, lock piece T3 | more locks | slow kill | Which lines survive lock pieces |
| `edh-graveyard-hate` | Hate-bear midrange | Rest in Peace-type T2 | removal | – | Reanimator/aristocrats resilience; sideboard planning |

## Authoring rules
- Each turn has `events: TrajectoryStep[]` with `actor: "opponent"`, plus a `boardSummary` string.
- Include **decision points** for the user's side: an event may carry `note` such as "Sweeper incoming next turn — hold back fodder."
- Keep tracks ≤ 12 turns; Commander tracks may include "table" summary lines (three opponents) rendered as one aggregated opponent side.
- Version tracks (`"schemaVersion": 1`). Validate with zod on load.
