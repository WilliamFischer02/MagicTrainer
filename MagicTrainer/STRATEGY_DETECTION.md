# Strategy Detection — design

See `knowledge/mtg-strategy/archetype-taxonomy.md` and `combo-patterns.md` for the theory. This is the engineering spec.

## Inputs
`ResolvedCard[]` = deck entries joined to `CardOracle` (with `oracleTags`). Unresolved names are reported, not guessed.

## Pattern = roles
`PatternDef { id, label, family, roles: RoleDef[], required: roleId[], playline? }`
`RoleDef { tags?, text?: RegExp[], type?: RegExp, custom?, min, weight }`
A card fills a role if (type matches) ∧ (custom passes) ∧ (any tag ∨ any regex) — or, for purely structural roles, the first two only.

## Scoring
- Role filled iff Σ quantity of matching cards ≥ `min`.
- Earned = Σ weight × min(1, 0.5 + qty / (2·min)) over filled roles; confidence = earned / Σ weight.
- Pattern fires iff every `required` role is filled. Report `NearMiss` when exactly one required role is unfilled (Deck Builder suggestions).

## Combo confirmation
- On deck load, POST the decklist to Commander Spellbook `find-my-combos` (cache by deck hash, 24 h). Union with local combo-family hits; when both exist, prefer Spellbook's `description` steps for the playline and keep the local rationale as secondary evidence.
- Offline: use the bulk `variants.json.gz` loaded into SQLite; match by oracle_id sets ⊆ deck.

## Outputs
`StrategyMatch[]` sorted by confidence, each with `roles`, `rationale` (which signal fired per card), `externalRef`.

## Quality gates
- Golden tests: William's six decks must produce the expected top archetype (see PROJECT_BRIEF success criteria).
- Every new pattern needs ≥ 1 positive and ≥ 1 negative fixture.
- No regex may match a bare keyword that appears in flavor/reminder text; test against a random 500-card sample for false-positive rate < 2 %.
