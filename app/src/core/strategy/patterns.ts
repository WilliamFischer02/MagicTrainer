import type { CardOracle } from "../types";

/**
 * Strategy pattern definitions.
 *
 * A pattern is a set of ROLES. Each role is a predicate over a CardOracle. The detector
 * fills roles from the deck, then scores the pattern by how many roles are filled and how
 * deeply (card counts). Predicates combine Scryfall Tagger oracle-tag slugs (preferred:
 * community-curated, stable across errata) with regex fallbacks over oracle text
 * (for cards Tagger hasn't covered). Keep regexes conservative; false positives are worse
 * than misses because the Trainer will animate whatever we claim.
 *
 * Tag slugs come from knowledge/mtg-data-apis/oracle-tag-index.json (4,559 tags, 2026-09-24).
 * `__tests__/patterns.test.ts` fails the build if a slug is not in that index. Note that the
 * data layer expands a card's tags with every ANCESTOR tag (oracle_tag_ancestors), so a parent
 * slug such as `recursion` (0 direct taggings, 96 children) matches any card tagged with a child.
 * Verified 2026-09-24 against the imported bulk: 12 of the original 44 slugs did not exist
 * (aristocrat, blood-artist, creature-tokens, death-trigger-other, looting, prowess, reanimation,
 * recursive-creature, rummaging, self-mill, soul-sister, undying) and were replaced or dropped.
 */

export interface RoleDef {
  id: string;
  label: string;
  /** Any of these oracle tags qualifies. */
  tags?: string[];
  /** Any of these regexes over lowercased oracle text qualifies. */
  text?: RegExp[];
  /** Type-line regex (e.g. /creature/). */
  type?: RegExp;
  /** Minimum copies (by quantity) needed for the role to count as filled. */
  min: number;
  /** Weight of this role in the confidence score. */
  weight: number;
  /** Optional predicate for anything the declarative fields can't express. */
  custom?: (c: CardOracle) => boolean;
}

export interface PatternDef {
  id: string;
  label: string;
  family: "combo" | "engine" | "archetype";
  summary: string;
  roles: RoleDef[];
  /** Roles that MUST be filled for the pattern to fire at all. */
  required: string[];
  /** At least ONE of these roles must also be filled (in addition to `required`). */
  anyOf?: string[];
  /** Whole-deck precondition (curve shape, creature share) evaluated before roles. */
  gate?: (deck: DeckShape) => boolean;
  /** Id of a playline template in trajectory/templates.ts used to animate the pattern. */
  playline?: string;
}

const txt = (...res: RegExp[]) => res;

/** Deck-level shape used by pattern gates; computed once per detection run. */
export interface DeckShape {
  nonland: number;
  lands: number;
  creatures: number;
  /** Average mana value of nonland cards. */
  averageMv: number;
  /** creatures / nonland, 0..1. */
  creatureShare: number;
}

export function deckShape(cards: readonly { card: CardOracle; quantity: number }[]): DeckShape {
  let nonland = 0;
  let lands = 0;
  let creatures = 0;
  let mv = 0;
  for (const { card, quantity } of cards) {
    const front = card.typeLine.split(" // ")[0] ?? card.typeLine;
    if (/\bLand\b/.test(front)) {
      lands += quantity;
      continue;
    }
    nonland += quantity;
    mv += card.cmc * quantity;
    if (/\bCreature\b/.test(front)) creatures += quantity;
  }
  return { nonland, lands, creatures, averageMv: nonland ? mv / nonland : 0, creatureShare: nonland ? creatures / nonland : 0 };
}

export const PATTERNS: PatternDef[] = [
  {
    id: "aristocrats",
    label: "Aristocrats (sacrifice engine)",
    family: "engine",
    summary:
      "Sacrifice your own creatures for value; death triggers drain or draw; recursion refuels. Wins by attrition or a drain loop.",
    required: ["outlet", "payoff"],
    playline: "aristocrats-loop",
    roles: [
      {
        id: "outlet",
        label: "Sacrifice outlet",
        min: 1,
        weight: 3,
        tags: ["sacrifice-outlet-creature", "repeatable-sacrifice-outlet", "free-sacrifice-outlet"],
        text: txt(/sacrifice (a|another) creature:/, /sacrifice a creature: /),
      },
      {
        id: "payoff",
        label: "Death-trigger payoff",
        min: 1,
        weight: 3,
        tags: ["blood-artist-ability", "your-sacrifice-matters"],
        text: txt(/whenever (a|another) creature (you control )?dies,/, /whenever .* dies, (each opponent|target player) loses/),
      },
      {
        id: "fodder",
        label: "Recurring/token fodder",
        min: 2,
        weight: 1,
        tags: ["repeatable-creature-tokens", "reanimate-self", "persist"],
        text: txt(/create .* creature token/, /return .* from your graveyard to the battlefield/, /\b(undying|persist)\b/),
      },
      {
        id: "recursion",
        label: "Graveyard recursion",
        min: 1,
        weight: 1,
        tags: ["reanimate-creature", "mass-reanimation", "recursion", "regrowth"],
        text: txt(/return (target )?creature card from your graveyard to (the battlefield|your hand)/),
      },
    ],
  },
  {
    id: "lifegain-drain-loop",
    label: "Lifegain / life-loss drain loop",
    family: "combo",
    summary:
      "'Whenever you gain life, opponent loses life' + 'whenever an opponent loses life, you gain life' = infinite drain (Exquisite Blood + Sanguine Bond and friends). Cross-check with Commander Spellbook.",
    required: ["gain-to-drain", "drain-to-gain"],
    playline: "drain-loop",
    roles: [
      {
        id: "gain-to-drain",
        label: "Lifegain → opponent loses life",
        min: 1,
        weight: 4,
        text: txt(/whenever you gain life, (each opponent|target (opponent|player)) loses (that much|1) life/),
      },
      {
        id: "drain-to-gain",
        label: "Opponent loses life → you gain life",
        min: 1,
        weight: 4,
        text: txt(/whenever an opponent loses life, you gain that much life/),
      },
      {
        id: "starter",
        label: "Incidental lifegain to start the loop",
        min: 1,
        weight: 1,
        tags: ["lifegain", "repeatable-lifegain", "soul-warden-ability"],
        text: txt(/you gain \d+ life/),
      },
    ],
  },
  {
    id: "reanimator",
    label: "Reanimator",
    family: "archetype",
    summary: "Put a huge creature into the graveyard early (discard, mill, self-sac) and return it to the battlefield cheaply.",
    required: ["reanimate", "enabler", "target"],
    playline: "reanimate",
    roles: [
      {
        id: "reanimate",
        label: "Reanimation spell/ability",
        min: 2,
        weight: 3,
        tags: ["reanimate-creature", "mass-reanimation", "reanimate-from-any"],
        text: txt(/return target creature card from (a|your) graveyard to the battlefield/),
      },
      {
        id: "enabler",
        label: "Graveyard filler (discard/mill/loot)",
        min: 2,
        weight: 2,
        tags: ["loot", "repeatable-loot", "mill-self", "rummage", "repeatable-rummage", "discard-outlet"],
        text: txt(/discard (a|one or more|two) cards?/, /mill(s)? (\d+|that many) cards?/),
      },
      {
        id: "target",
        label: "Reanimation target (mana value ≥ 6 creature)",
        min: 2,
        weight: 2,
        type: /creature/i,
        custom: (c) => c.cmc >= 6,
      },
    ],
  },
  {
    id: "power-ramp-stompy",
    label: "Ramp into big creatures (stompy / power-matters)",
    family: "archetype",
    summary: "Accelerate mana with dorks/ramp spells, deploy oversized tramplers, refill by drawing off power, finish with an overrun effect.",
    required: ["ramp", "threat"],
    playline: "ramp-overrun",
    roles: [
      { id: "ramp", label: "Mana ramp (dorks, land ramp, rocks)", min: 6, weight: 3, tags: ["ramp", "mana-dork", "mana-rock", "land-ramp"], text: txt(/search your library for (a|up to \w+) (basic )?land/, /add \{[wubrgc]\}/) },
      { id: "threat", label: "Big creatures (power ≥ 5)", min: 6, weight: 3, type: /creature/i, custom: (c) => Number(c.power) >= 5 },
      { id: "overrun", label: "Overrun / mass pump finisher", min: 1, weight: 2, tags: ["overrun", "power-boost-to-all"], text: txt(/creatures you control get \+\d+\/\+\d+ .* until end of turn/) },
      { id: "refill", label: "Draw off power / card advantage", min: 1, weight: 1, tags: ["draw-engine", "burst-draw"], text: txt(/draw cards equal to .* power/) },
    ],
  },
  {
    id: "prowess-tempo",
    label: "Prowess / spells-matter tempo",
    family: "archetype",
    summary: "Cheap creatures that grow when you cast noncreature spells, backed by burn and light interaction.",
    required: ["prowess", "spells"],
    playline: "prowess-turn",
    roles: [
      {
        id: "prowess",
        label: "Prowess / noncreature-spell triggers",
        min: 4,
        weight: 3,
        type: /creature/i,
        tags: ["gives-prowess", "prowess-anthem"],
        text: txt(/whenever you cast a noncreature spell/, /whenever you cast an instant or sorcery spell/),
        custom: (c) => c.keywords.includes("Prowess") || /whenever you cast a noncreature spell|whenever you cast an instant or sorcery spell/i.test(c.oracleText ?? ""),
      },
      { id: "spells", label: "Cheap instants/sorceries", min: 12, weight: 2, type: /instant|sorcery/i, custom: (c) => c.cmc <= 2 },
      { id: "burn", label: "Burn / reach", min: 4, weight: 1, tags: ["burn-any", "burn-player", "burn-creature"] },
    ],
  },
  {
    id: "artifact-aggro",
    label: "Artifact aggro (Affinity-style)",
    family: "archetype",
    summary: "Flood the board with cheap artifacts, then convert artifact count into damage via lords/equipment.",
    required: ["cheap-artifacts", "payoff"],
    playline: "affinity-turn",
    roles: [
      { id: "cheap-artifacts", label: "0–1 mana artifacts/artifact creatures", min: 8, weight: 3, type: /artifact/i, custom: (c) => c.cmc <= 1 },
      { id: "payoff", label: "Artifact-count payoff", min: 2, weight: 3, tags: ["synergy-artifact", "affinity-for-artifacts"], text: txt(/affinity for artifacts/, /for each artifact you control/, /equipped creature gets \+1\/\+0 for each artifact/) },
    ],
  },
  {
    id: "go-wide-tokens",
    label: "Go-wide tokens",
    family: "archetype",
    summary: "Make many small creatures and win with anthems or mass pump.",
    required: ["tokens", "anthem"],
    roles: [
      { id: "tokens", label: "Token makers", min: 6, weight: 3, tags: ["repeatable-creature-tokens"], text: txt(/create .* creature tokens?/) },
      { id: "anthem", label: "Anthems / mass pump", min: 2, weight: 3, tags: ["anthem", "power-boost-to-all"], text: txt(/creatures you control get \+\d+\/\+\d+/) },
    ],
  },
  {
    id: "voltron",
    label: "Voltron (single evasive threat + auras/equipment)",
    family: "archetype",
    summary: "Load one creature with equipment/auras and protection; win via commander damage or a single lethal attacker.",
    required: ["boost"],
    anyOf: ["protection", "evasion"],
    roles: [
      { id: "boost", label: "Equipment / auras", min: 6, weight: 3, type: /equipment|aura/i },
      { id: "protection", label: "Protection / hexproof grants", min: 2, weight: 2, tags: ["protects-creature", "gives-hexproof", "gives-indestructible"] },
      { id: "evasion", label: "Evasion grants", min: 2, weight: 1, tags: ["evasion", "gives-unblockable", "gives-flying"] },
    ],
  },
  {
    id: "creature-aggro",
    label: "Creature aggro (beatdown)",
    family: "archetype",
    summary: "Many cheap creatures, curve out by turn 3, back them with tricks, haste, and burn to close. You are the beatdown.",
    required: ["cheap-threats"],
    anyOf: ["tricks", "reach", "removal"],
    // Aggro is a curve, not a card count: mostly creatures and a low average mana value.
    gate: (d) => d.creatureShare >= 0.5 && d.averageMv <= 3.0,
    roles: [
      { id: "cheap-threats", label: "Creatures at mana value ≤ 3", min: 14, weight: 3, type: /creature/i, custom: (c) => c.cmc <= 3 },
      { id: "tricks", label: "Combat tricks / haste / mass pump", min: 4, weight: 1, tags: ["combat-trick", "gives-haste", "power-boost-to-all"] },
      { id: "reach", label: "Burn to the face", min: 3, weight: 1, tags: ["burn-any", "burn-player"] },
      { id: "removal", label: "Cheap removal", min: 3, weight: 1, tags: ["spot-removal", "removal-creature"], custom: (c) => c.cmc <= 2 },
    ],
  },
  {
    id: "stompy",
    label: "Stompy (undercosted beaters + pump)",
    family: "archetype",
    summary: "Cheap creatures with outsized power, protected and pushed through with pump spells and auras. No ramp package — the curve is the plan.",
    required: ["beaters", "pump"],
    roles: [
      { id: "beaters", label: "Power ≥ 3 at mana value ≤ 3", min: 8, weight: 3, type: /creature/i, custom: (c) => c.cmc <= 3 && Number(c.power) >= 3 },
      {
        id: "pump",
        label: "Pump spells / auras / trample grants",
        min: 6,
        weight: 2,
        tags: ["combat-trick", "synergy-aura", "gives-trample"],
        text: txt(/gets \+\d+\/\+\d+ until end of turn/, /enchanted creature gets \+\d+\/\+\d+/),
      },
      { id: "protection", label: "Hexproof / protection tricks", min: 2, weight: 1, tags: ["protects-creature", "gives-hexproof", "gives-indestructible"] },
    ],
  },
  {
    id: "burn",
    label: "Burn",
    family: "archetype",
    summary: "Point damage at the face: 12+ cheap burn spells plus a few hasty or damage-dealing creatures. Count to 20.",
    required: ["burn"],
    roles: [
      { id: "burn", label: "Burn spells that can target players", min: 12, weight: 3, type: /instant|sorcery/i, tags: ["burn-any", "burn-player"] },
      { id: "burn-creatures", label: "Creatures that deal damage", min: 2, weight: 1, type: /creature/i, tags: ["burn-any", "burn-player", "gives-haste"] },
    ],
  },
  {
    id: "spellslinger",
    label: "Spellslinger (instants & sorceries matter)",
    family: "archetype",
    summary: "Payoffs that trigger on casting instants and sorceries, a deck that is mostly spells, and cost reducers or storm to chain them.",
    required: ["payoff", "spells"],
    roles: [
      {
        id: "payoff",
        label: "Instant/sorcery cast payoffs",
        min: 4,
        weight: 3,
        tags: ["magecraft", "second-spell-matters"],
        text: txt(/whenever you cast an instant or sorcery spell/, /whenever you cast or copy an instant or sorcery spell/, /whenever you cast a noncreature spell/),
      },
      { id: "spells", label: "Instants and sorceries", min: 20, weight: 2, type: /instant|sorcery/i },
      { id: "chain", label: "Cost reducers / storm", min: 1, weight: 1, tags: ["cost-reducer", "affinity-for-spells", "storm-count-matters", "gives-storm"] },
    ],
  },
  {
    id: "control",
    label: "Control (answers first, win late)",
    family: "archetype",
    summary: "Counterspells and sweepers hold the game, card draw pulls ahead, a few resilient finishers close. You are not the beatdown.",
    required: ["removal"],
    anyOf: ["counters", "sweepers"],
    // Control is creature-light; a Commander value pile with sweepers and removal is not control.
    gate: (d) => d.creatureShare <= 0.35,
    roles: [
      { id: "counters", label: "Counterspells", min: 4, weight: 2, tags: ["counterspell"] },
      { id: "sweepers", label: "Sweepers", min: 2, weight: 2, tags: ["sweeper"] },
      { id: "removal", label: "Spot removal", min: 6, weight: 1, tags: ["spot-removal"] },
      { id: "draw", label: "Card advantage", min: 4, weight: 1, tags: ["draw-engine", "burst-draw"] },
      { id: "finisher", label: "Late-game finishers", min: 2, weight: 1, type: /creature|planeswalker/i, custom: (c) => c.cmc >= 4 },
    ],
  },
  {
    id: "counters-midrange",
    label: "+1/+1 counters",
    family: "archetype",
    summary: "Creatures and spells that put +1/+1 counters everywhere, with payoffs that scale off counters (Hardened Scales style).",
    required: ["payoff", "enablers"],
    roles: [
      { id: "payoff", label: "Counters-matter payoffs", min: 3, weight: 3, tags: ["counters-matter", "pp-counters-matter"] },
      { id: "enablers", label: "Ways to place +1/+1 counters", min: 6, weight: 2, tags: ["gives-pp-counters", "repeatable-pp-counters", "repeatable-proliferate"] },
    ],
  },
];
