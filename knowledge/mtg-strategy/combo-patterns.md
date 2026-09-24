# Combo Patterns — structural shapes

Combos are graphs, not lists. Detect the **shape** and then confirm concrete cards against
Commander Spellbook (`../mtg-data-apis/commander-spellbook/`). Variants there carry
`zoneLocations` per card ("B" battlefield, "H" hand, "G" graveyard, "L" library, "E" exile, "C" command),
prerequisites, step-by-step `description`, and `produces` features — exactly what the Trainer animates.

## 1. Two-card trigger loops (A ↔ B)
Shape: A's trigger causes an event that triggers B; B's trigger causes an event that triggers A.
- Lifegain/loss loop: "whenever you gain life, opponent loses life" + "whenever an opponent loses life, you gain that much life." (Sanguine Bond + Exquisite Blood is the canonical pair.) Mandatory loop — ends when a player loses (CR 704.5a) or a player breaks it.
- Rules note: each iteration is a separate triggered ability using the stack (CR 603.2). Once the loop is shown to be deterministic, players shortcut it by declaring the outcome (MTR 4.4 "Loops").

## 2. Sacrifice + return engines
Shape: free sacrifice outlet + a creature that comes back (persist/undying/"return it to the battlefield") + something that removes the counter that stops it (Melira-style) or a payoff for each death.
Roles: `outlet`, `returner`, `counter-fix` (optional), `payoff`. With a death payoff this is infinite drain; without one it's an infinite sac-outlet activation (scry, +2/+2, etc.).

## 3. Untap loops
Shape: a permanent that produces ≥ N mana or value + an effect that untaps it for < N cost, repeatable.
Roles: `producer` (mana rock/dork/land), `untapper` (aura/equipment/creature), sometimes `copy`.
Produces infinite mana → needs a `mana sink` role to actually win. Detector must flag "infinite mana with no sink" as incomplete.

## 4. ETB / LTB (blink) loops
Shape: creature with ETB effect + repeatable blink/flicker (often triggered by the ETB itself).
Roles: `etb-value`, `blink-engine`, optional `payoff-on-etb` (Soul Warden types).
Zone signature: Battlefield→Exile→Battlefield.

## 5. Cast-trigger / storm engines
Shape: cost reduction + cheap spells + card draw per cast + payoff per cast (storm count, prowess, magecraft).
Not "infinite" — a *density* combo. Detect by counts: cheap spells ≥ 15, ≥ 2 payoffs, ≥ 2 cantrip engines.

## 6. Mill / draw kill
Shape: "draw N" or "mill N" repeatable at scale + a self-protection piece (no-max-hand / can't lose from drawing).
Roles: `symmetric-draw` or `repeatable-mill`, `protection`.

## 7. Aristocrats drain (finite but lethal)
Shape: token/fodder production + free sac outlet + 2+ drain payoffs. Each fodder = N life across the table. In Commander, with ~4 payoffs, 10 sacrifices ≈ 40 life per opponent.
This is the default engine for William's Athreos deck; use it as the reference implementation.

## 8. Reanimation "cheat"
Shape: one-shot: discard/mill a high-MV target → cheap reanimation. Not a loop; a tempo cheat. Evaluate by *turn achieved* (T2/T3) rather than infinity.

## Detection algorithm sketch

1. Resolve deck → card records with oracle tags.
2. For each pattern in `patterns.ts`: fill roles, compute confidence, list missing required roles.
3. For patterns of family `combo`: query Commander Spellbook `find-my-combos` (POST decklist) once per deck load; cache result keyed by deck hash; union with local pattern hits; prefer Spellbook's step text for the animation script.
4. Emit `StrategyMatch[]` sorted by confidence; emit `NearMiss[]` where exactly one required role is unfilled (Deck Builder upgrade suggestions come from these).
5. Build `Playline` from template (local) or from Spellbook `description` steps (parsed into `TrajectoryStep`s by zone keywords: "cast", "sacrifice", "return … to the battlefield", "exile", "dies").

## Guardrails
- Never animate a combo the detector can't cite (rationale must list the cards + tag/regex/spellbook-id that fired).
- Distinguish **mandatory** loops (game ends) from **optional** loops (player chooses count). Say which.
- Show the *rules cost* of the line: mana, cards in hand consumed, turns, and what interaction breaks it (removal on the outlet, graveyard hate, etc.). Training value lives in the break points.
