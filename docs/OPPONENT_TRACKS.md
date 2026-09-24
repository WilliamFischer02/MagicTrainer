# Opponent Tracks — spec

Schema = `OpponentTrack` (`app/src/core/types.ts`), validated with zod at load (`schemaVersion: 1`).
Files: `/opponent-tracks/<id>.track.json`. Placeholders `[role]` render as generic cards.

Merge rule with the user's playline: sort all steps by `(turn, phaseIndex, actorOrder)` where the
active player's actions come first in their own turn; opponent steps carry `actor: "opponent"`.
Decision-point notes on opponent steps are surfaced in the step panel *before* the user's next step.

Authoring checklist: real cards verified on Scryfall or explicit `[role]`; ≤ 12 turns; each turn has a `boardSummary`;
at least one decision-point note; a `teaches` sentence in `description`.
