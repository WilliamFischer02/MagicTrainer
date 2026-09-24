---
description: Author a new scripted opponent track JSON in /opponent-tracks following the spec. Use when a new archetype opponent is needed for the Trainer.
allowed-tools: Read, Write, Edit, Bash(npm test*)
argument-hint: [track id]
---
Follow `docs/OPPONENT_TRACKS.md` and `knowledge/mtg-strategy/opponent-archetype-tracks.md`.
- `schemaVersion: 1`; ≤ 12 turns; each turn has `boardSummary`; each event is a `TrajectoryStep` with `actor: "opponent"`.
- Use `[role]` placeholders or Scryfall-verified names (`/scryfall-verify`).
- Include ≥ 1 decision-point `note` for the user's side and a "teaches" sentence in `description`.
- Validate against the zod schema (`app/src/core/opponent/schema.ts`) in a test.
