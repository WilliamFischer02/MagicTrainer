# Archetype Taxonomy

The detector works on **roles** (functional slots in a deck), not card names. A deck "is" an
archetype when enough of its roles are filled. Most real decks blend two or three archetypes;
the detector should rank them, not pick one.

## Layer 1 — Macro-archetypes (all constructed formats)

| Macro | Game plan | Core resources | Typical role slots | How it wins |
|---|---|---|---|---|
| **Aggro** | Deploy threats fast, pressure life total before opponent stabilizes. | Tempo, low curve, burn/reach | 1–2 drop creatures ×12+, pump/burn, few lands (18–20 in 60) | Damage race; reach finishes |
| **Midrange** | Efficient threats + efficient answers; out-value aggro, out-pressure control. | Card quality | 3–4 drop value creatures, spot removal, planeswalkers | Attrition then beatdown |
| **Control** | Answer everything, win late with few inevitable threats. | Card advantage, life as a resource | Counterspells, sweepers, draw engines, 2–4 finishers | Inevitability |
| **Combo** | Assemble a specific set of cards that wins on the spot. | Consistency (tutors/draw), protection | Combo pieces, tutors, cantrips, protection (counters/discard) | Deterministic kill |
| **Tempo** | Cheap threats + cheap interaction; keep opponent off-balance, not off the board. | Mana efficiency | Prowess/flash creatures, bounce, cheap counters, burn | Damage while opponent stumbles |
| **Ramp** | Accelerate mana, cast oversized threats early. | Mana | Dorks, land ramp, rocks; payoffs at MV 5+ | Overwhelming board or a single haymaker |
| **Prison / Stax** | Restrict what the opponent can do (mana, casting, attacking). | Asymmetry | Taxing effects, lock pieces, few win cons | Opponent can't play; slow kill |

**Who's the Beatdown (Flores, 1999 — foundational):** in any matchup one deck is the beatdown
(must pressure) and one is the control (must stabilize). Misassigning this role is the most common
strategic mistake. The Trainer's coaching overlay should state which role the user's deck holds
against the current opponent track and why.

## Layer 2 — Commander / EDH archetypes

Commander is multiplayer (CR 800–810, 903), 40 life, one deck of 99 + commander, singleton
(CR 903.5b). Archetypes skew toward **engines** (repeatable value) over one-shot tempo.

| Archetype | Roles (detector slots) | Win pattern | Zone signature |
|---|---|---|---|
| **Aristocrats** | sac outlet, death-trigger payoff, fodder/tokens, recursion | Drain loop or grind | Battlefield→Graveyard→Battlefield cycles; payoff pulses to opponents |
| **Reanimator** | graveyard filler (loot/mill/discard), reanimation spells, high-MV targets | Cheat a huge threat early; ETB value | Hand→Graveyard→Battlefield skips the stack/mana |
| **Voltron** | equipment/auras, protection, evasion, a commander that scales | 21 commander damage (CR 903.10a) | Everything converges on one permanent; arrows terminate at one node |
| **Go-wide / Tokens** | token makers, anthems, mass pump, sac synergies | Overrun / alpha strike | Fan-out from one source to many battlefield nodes |
| **Spellslinger / Storm** | cheap instants/sorceries, cast-trigger payoffs, cost reducers, copy effects | Storm count / burn triggers | Hand→Stack→Graveyard rapid churn; payoff pulses per cast |
| **+1/+1 counters** | counter placers, doublers (Hardened Scales-type), proliferate, counter payoffs | Big trampling board | Battlefield self-loops (state changes without zone changes) |
| **Lifegain** | incidental gain, gain payoffs, drain converters | Drain loop or huge life → payoff | Payoff pulses; lifelink attack arrows |
| **Blink / Flicker** | ETB creatures, blink effects, repeatable blink engine | Value lock | Battlefield→Exile→Battlefield micro-loops |
| **Enchantress** | enchantments, enchantment-cast draw, pillow-fort pieces | Card advantage lock | Hand→Battlefield with a draw pulse each cast |
| **Lands** | land ramp, landfall payoffs, land recursion, sac lands | Landfall damage/tokens | Library→Battlefield arrows for lands; payoff pulses |
| **Graveyard / Dredge / Self-mill** | self-mill, graveyard payoffs, recursion | Value from graveyard as second hand | Library→Graveyard then Graveyard→Hand/Battlefield |
| **Artifacts** | cheap artifacts, artifact payoffs, cost reducers, untap engines | Combo or aggro | Battlefield density; untap loops |
| **Typal (tribal)** | creature type lords, type-based draw/ramp, type synergy | Go-wide with lords | Fan-out with anthem pulses |
| **Wheels / Discard** | wheel effects, discard payoffs, draw punishers | Symmetric-draw payoffs | Hand↔Graveyard mass churn for all players |
| **Stax** | tax pieces, lock pieces, mana denial | Attrition while locked | Opponent tracks show blocked arrows |
| **Group hug / politics** | symmetric draw/ramp, goad, incentives | Table dynamics, often a late combo | Arrows to *opponents'* hands (deliberately) |
| **Ramp / Big mana** | dorks, land ramp, mana doublers, haymakers | Overrun / eldrazi-scale threats | Library→Battlefield ramp arrows, then large single threat casts |

## Layer 3 — Modern / 60-card constructed archetype families (for William's decks)

| Family | Detector roles | Notes |
|---|---|---|
| **Izzet Prowess / Tempo** | prowess creatures ≥4 (playsets), cheap spells ≥12, burn ≥4 | William's "Purple" |
| **Boros Aggro** | 1–2 drops ≥10, anthem, combat tricks, removal | William's "Pink" |
| **Mono-Green Stompy** | undercosted beaters (power ≥3 at MV ≤3) ≥8, pump ≥6 | William's "Stompy" |
| **Affinity / Artifact Aggro** | 0–1 MV artifacts ≥8, artifact-count payoffs ≥2 | William's "Affinity" (designed, unconfirmed) |
| **Burn** | burn spells ≥12 targeting players | |
| **UW Control** | counters ≥6, sweepers ≥3, draw engines, ≤4 finishers | Good default opponent track |
| **Tron / Big mana** | land-search, MV 7+ payoffs | |
| **Graveyard combo (Dredge-style)** | self-mill ≥8, graveyard payoffs | |

## Role detection signal hierarchy (highest confidence first)

1. **Scryfall Tagger oracle tags** (`oracleTags` on the card record) — community-curated, survives errata. See `../mtg-data-apis/oracle-tag-index.json` for the 4,559 slugs and counts.
2. **Commander Spellbook variants** for anything claiming "infinite" or "combo" — never invent a combo the database doesn't have unless the user marks it manual.
3. **Type-line / mana-value structure** (creature counts by MV, artifact density, land count).
4. **Oracle-text regexes** — narrow phrasings only ("sacrifice a creature:", "whenever you gain life,"). Last resort; always store the regex that fired in the rationale so the user can audit it.

## Quantitative thresholds (starting points; tune with real decks)

- Commander deck skeleton (a widely used baseline, adjust per archetype): ~36–38 lands (incl. MDFCs), 10 ramp, 10 draw, 8–10 removal/interaction, 2–3 sweepers, remaining ~30 slots for the plan.
- An archetype fires when required roles are filled **and** ≥ 60% of weighted roles are filled.
- A combo fires only when *all* required pieces are present; report "1 piece missing" as a separate "near-combo" suggestion in Deck Builder mode.
