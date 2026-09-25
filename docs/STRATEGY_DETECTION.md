# Strategy Detection — design

See `knowledge/mtg-strategy/archetype-taxonomy.md` and `combo-patterns.md` for the theory. This is the engineering spec.

## Inputs
`ResolvedCard[]` = deck entries joined to `CardOracle` (with `oracleTags`). Unresolved names are reported, not guessed.

## Pattern = roles
`PatternDef { id, label, family, roles: RoleDef[], required: roleId[], anyOf?: roleId[], gate?: (DeckShape) => boolean, playline? }`
`RoleDef { tags?, text?: RegExp[], type?: RegExp, custom?, min, weight }`
A card fills a role if (type matches) ∧ (custom passes) ∧ (any tag ∨ any regex) — or, for purely structural roles, the first two only.

## Scoring
- Role filled iff Σ quantity of matching cards ≥ `min`.
- Earned = Σ weight × min(1, 0.5 + qty / (2·min)) over filled roles; confidence = earned / Σ weight.
- Pattern fires iff every `required` role is filled AND (when `anyOf` is set) at least one `anyOf` role is filled AND (when `gate` is set) the whole-deck gate passes. `DeckShape` = { nonland, lands, creatures, averageMv, creatureShare } — used so "aggro" is a curve, not a card count (2026-09-24, strategy-analyst audit).
- Report `NearMiss` when exactly one required role is unfilled (Deck Builder suggestions) — not implemented yet; Spellbook near-misses ship first.

## Combo confirmation
- On deck load, POST the decklist to Commander Spellbook `find-my-combos` (cache by deck hash, 24 h). Union with local combo-family hits; when both exist, prefer Spellbook's `description` steps for the playline and keep the local rationale as secondary evidence.
- Offline: use the bulk `variants.json.gz` loaded into SQLite; match by oracle_id sets ⊆ deck.

## Outputs
`StrategyMatch[]` sorted by confidence, each with `roles`, `rationale` (which signal fired per card), `externalRef`.

## Quality gates
- Golden tests (`app/src/data/__tests__/samples-strategy.test.ts`, real DB): per deck a `must` set, a `topOneOf` set, and a `mustNot` set — a deck can legitimately carry two labels (Athreos = aristocrats + drain loop). 2026-09-24 expectations: Athreos → aristocrats + lifegain-drain-loop; Ghalta → power-ramp-stompy; Affinity → artifact-aggro; Mono-green → stompy (and NOT prowess-tempo); Boros "Pink" → creature-aggro; Izzet "Purple" → prowess-tempo.
- Every new pattern needs ≥ 1 positive and ≥ 1 negative fixture.
- No regex may match a bare keyword that appears in flavor/reminder text; test against a random 500-card sample for false-positive rate < 2 %.

## Pattern inventory (2026-09-24)
14 patterns in `patterns.ts`: aristocrats, lifegain-drain-loop, reanimator (now requires the enabler package), power-ramp-stompy, prowess-tempo (real Prowess / noncreature-cast triggers only), artifact-aggro, go-wide-tokens, voltron (boost + protection|evasion), creature-aggro (gated on curve), stompy (constructed: beaters + pump), burn, spellslinger, control (removal + counters|sweepers), counters-midrange. Still missing from the taxonomy: storm as its own line, stax, blink, group-hug/politics.
