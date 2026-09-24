# Deckbuilding Fundamentals (for Deck Builder mode)

RECALL-class theory. Numbers are conventional starting points widely used by competitive
players and content creators; the app should present them as **defaults the user can edit**, not laws.

## Consistency math
- Hypergeometric distribution is the tool: P(at least k copies of an n-of in the top m cards of a D-card deck). Implement `hypergeometric(D, n, m, k)` in core and expose it in the UI ("Odds of a 1-drop in your opening 7: 71%").
- 60-card: 4 copies ≈ 40% in opening 7, ≈ 60% by turn 4 (on the draw). 100-card singleton: 1 copy ≈ 7% in opening 7, ≈ 10% by turn 4 — hence tutors, draw, and *redundancy* (multiple cards filling the same role).
- "8×8 / 8×10 theory" (Commander): pick ~8 sub-themes, run ~8–10 cards each → every hand shows most themes.

## Mana
- 60-card guidelines (Karsten-style, adjust by curve): aggro 20–22 lands, midrange 23–24, control 25–26. Mana dorks count as ~½ a land for curve purposes, not for color.
- Commander: 36–38 lands + 8–12 ramp is the mainstream baseline; low curves (avg MV ≤ 2.5) can go to 33–34. Count MDFC lands as lands.
- Color requirements: a spell with {C}{C} on turn 2 wants ~19+ sources in 60; single-pip on turn 1 wants ~14+. In Commander, aim for each color's sources ≥ (pips demanded × ~4) as a rough heuristic, then check with the hypergeometric calculator.
- Curve shape by archetype: aggro peaks at 1–2; midrange at 2–3; control flat with 4–6 tail; ramp bimodal (2 and 5+).

## Card advantage & tempo (the two axes every play is judged on)
- **Card advantage (CA):** net cards gained vs. spent. 2-for-1s, engines, sweepers vs. go-wide.
- **Tempo:** mana-efficiency of board impact this turn. Bounce, cheap removal on expensive threats, haste.
- **Virtual card advantage:** cards in the opponent's hand that are dead vs. your deck (their removal vs. your token deck).
- **Velocity:** how fast a deck sees its key cards (cantrips, looting, tutors).

## Threat density & answer density
- Aggro: ≥ 20 threats in 60; each removal spell the opponent draws must have a target.
- Control: ≥ 10 answers + ≥ 4 sweepers vs. wide decks; ≤ 4 finishers that win alone.
- Commander: interaction is the most common deficit in casual decks (William's Ghalta list is a case study: thin interaction, no sweepers).

## Evaluating a deck (checklist the Builder should run)
- [ ] Land count vs. curve (show histogram of MV).
- [ ] Color sources per color vs. pips.
- [ ] Role coverage: ramp / draw / removal / sweepers / win-cons / protection (counts vs. baseline).
- [ ] Redundancy of the primary strategy (how many cards fill each key role).
- [ ] Interaction against the three most common opponent tracks (aggro, control, combo).
- [ ] Near-miss combos (one piece missing) with owned-collection cross-check first, then Card Kingdom price.
- [ ] Legality: format banlist (`../mtg-rules/FMT-ALL_banned-restricted-list_*.md`, plus a live check), singleton, color identity (CR 903.4).

## Sideboarding (60-card)
- Sideboard 15; bring in answers to the opponent's plan, board out cards that are dead in the matchup. Track "in/out" plans per matchup — the Trainer can display them per opponent track.

## Budget discipline (William's standing preference)
- Always show a budget line beside the optimal line; state the power tradeoff honestly.
- Cross-check the owned collection (ManaBox import) before recommending a purchase; prefer moving a card between the user's decks over buying.
- Flag reprint risk on anything > $15 and rotation risk for Standard-legal buys.
