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
 * Verify a slug exists there before adding it here.
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
  /** Id of a playline template in trajectory/templates.ts used to animate the pattern. */
  playline?: string;
}

const txt = (...res: RegExp[]) => res;

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
        tags: ["sacrifice-outlet-creature", "sacrifice-outlet", "free-sacrifice-outlet"],
        text: txt(/sacrifice (a|another) creature:/, /sacrifice a creature: /),
      },
      {
        id: "payoff",
        label: "Death-trigger payoff",
        min: 1,
        weight: 3,
        tags: ["death-trigger-other", "aristocrat", "blood-artist"],
        text: txt(/whenever (a|another) creature (you control )?dies,/, /whenever .* dies, (each opponent|target player) loses/),
      },
      {
        id: "fodder",
        label: "Recurring/token fodder",
        min: 2,
        weight: 1,
        tags: ["repeatable-creature-tokens", "recursive-creature", "creature-tokens", "undying", "persist"],
        text: txt(/create .* creature token/, /return .* from your graveyard to the battlefield/),
      },
      {
        id: "recursion",
        label: "Graveyard recursion",
        min: 1,
        weight: 1,
        tags: ["reanimation", "mass-reanimation", "recursion", "regrowth"],
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
        tags: ["lifegain", "repeatable-lifegain", "soul-sister"],
        text: txt(/you gain \d+ life/),
      },
    ],
  },
  {
    id: "reanimator",
    label: "Reanimator",
    family: "archetype",
    summary: "Put a huge creature into the graveyard early (discard, mill, self-sac) and return it to the battlefield cheaply.",
    required: ["reanimate", "target"],
    playline: "reanimate",
    roles: [
      {
        id: "reanimate",
        label: "Reanimation spell/ability",
        min: 2,
        weight: 3,
        tags: ["reanimation", "mass-reanimation"],
        text: txt(/return target creature card from (a|your) graveyard to the battlefield/),
      },
      {
        id: "enabler",
        label: "Graveyard filler (discard/mill/loot)",
        min: 2,
        weight: 2,
        tags: ["looting", "self-mill", "rummaging", "discard-outlet"],
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
      { id: "prowess", label: "Prowess / cast-trigger creatures", min: 4, weight: 3, tags: ["prowess", "cast-trigger-you"], text: txt(/prowess/, /whenever you cast a noncreature spell/) },
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
      { id: "tokens", label: "Token makers", min: 6, weight: 3, tags: ["creature-tokens", "repeatable-creature-tokens"], text: txt(/create .* creature tokens?/) },
      { id: "anthem", label: "Anthems / mass pump", min: 2, weight: 3, tags: ["anthem", "power-boost-to-all"], text: txt(/creatures you control get \+\d+\/\+\d+/) },
    ],
  },
  {
    id: "voltron",
    label: "Voltron (single evasive threat + auras/equipment)",
    family: "archetype",
    summary: "Load one creature with equipment/auras and protection; win via commander damage or a single lethal attacker.",
    required: ["boost"],
    roles: [
      { id: "boost", label: "Equipment / auras", min: 6, weight: 3, type: /equipment|aura/i },
      { id: "protection", label: "Protection / hexproof grants", min: 2, weight: 2, tags: ["protects-creature", "gives-hexproof", "gives-indestructible"] },
      { id: "evasion", label: "Evasion grants", min: 2, weight: 1, tags: ["evasion", "gives-unblockable", "gives-flying"] },
    ],
  },
];
