# Opponent Tracks — spec

Schema = `OpponentTrack` (`app/src/core/types.ts`), validated with zod at load (`schemaVersion: 1`).
Files: `/opponent-tracks/<id>.track.json`. Placeholders `[role]` render as generic cards.

Merge rule with the user's playline: sort all steps by `(turn, phaseIndex, actorOrder)` where the
active player's actions come first in their own turn; opponent steps carry `actor: "opponent"`.
Decision-point notes on opponent steps are surfaced in the step panel *before* the user's next step.

Authoring checklist: real cards verified on Scryfall or explicit `[role]`; ≤ 12 turns; each turn has a `boardSummary`;
at least one decision-point note; a `teaches` sentence in `description`.

## Authoring rules learned 2026-09-25 (enforced by `core/opponent/schema.ts` + `data/__tests__/tracks-cards.test.ts`)
- `schemaVersion: 1`; kebab-case `id`; ≤ 12 strictly increasing turns; every event's `turn` equals its block's `turn`; step numbers unique.
- `description` must say what the track **teaches**; at least one event carries a `breakPoint` or a "Decision point" note; every turn has a `boardSummary`.
- Real card names must resolve exactly in the Scryfall DB (test); role placeholders stay bracketed: `[burn spell]`, `[team]`, `[all your creatures]`, `[your graveyard]`.
- A spell `cast` to the `stack` needs a matching `resolve` event (→ `graveyard` for instants/sorceries, → `battlefield` for permanents); otherwise it stays on the stack.
- Permanents that start in play (Leyline) use `action: "begins-on-battlefield"`; lands use `play-land`; group effects use the bracketed group names above.
- Put `damage` on attacks and burn so the ledger and the board summaries agree; `lifeChange` for drains/lifegain.
- Cite rules as `CR ###.#x` / `MTR #.#` in notes and grep-verify them in `knowledge/mtg-rules/` first; the step panel turns them into buttons.
- Shipped: mono-red-aggro, uw-control, bg-midrange, combo-storm, edh-precon-value, edh-stax, edh-graveyard-hate.

