---
description: Add or refine a strategy/combo detection pattern in app/src/core/strategy/patterns.ts with fixtures. Use when a deck's archetype is missed or misdetected.
allowed-tools: Read, Edit, Write, Grep, Bash(npm test*)
argument-hint: [pattern id]
---
1. Read `knowledge/mtg-strategy/archetype-taxonomy.md` + `combo-patterns.md` for the role vocabulary.
2. Prefer oracle-tag slugs (verify each in `knowledge/mtg-data-apis/oracle-tag-index.json`) over regexes; regexes must be narrow and quoted in the rationale.
3. Add `required` roles, weights, and a `playline` template id if animatable.
4. Add ≥ 1 positive and ≥ 1 negative fixture in `app/src/core/__tests__/strategy.test.ts`; run `npm test`.
5. Re-run the six golden decks (`data/samples/decks`) and confirm no regression in their top archetype.
