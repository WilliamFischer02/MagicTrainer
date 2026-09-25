import type { Playline, StrategyMatch, TrajectoryStep } from "../types";

/**
 * Playline templates turn a StrategyMatch into an animated sequence of zone transitions.
 * They are deliberately schematic: they do not evaluate rules or mana. Each template picks
 * concrete card names out of the match's role buckets so the board shows the player's own cards.
 *
 * Rule citations in notes reference the Comprehensive Rules bundled in knowledge/mtg-rules/
 * (verified present 2026-09-25: 113.7a, 302.6, 400.7, 509.1, 510.1, 514.1, 601.2, 603.2, 603.6a,
 * 603.6c, 702.19, 702.19b, 702.41, 702.108a, 704.5a; MTR 4.2). `breakPoint` is the training payload:
 * the interaction that stops the step and what to do instead.
 */

type Template = (m: StrategyMatch, deckId: string) => Playline | null;

const first = (m: StrategyMatch, role: string) => m.roles[role]?.[0];
const nth = (m: StrategyMatch, role: string, i: number) => m.roles[role]?.[i];

function step(partial: Omit<TrajectoryStep, "step" | "actor"> & { actor?: "you" | "opponent" }): TrajectoryStep {
  return { step: 0, actor: partial.actor ?? "you", ...partial };
}

function number(steps: TrajectoryStep[]): TrajectoryStep[] {
  return steps.map((s, i) => ({ ...s, step: i + 1 }));
}

export const TEMPLATES: Record<string, Template> = {
  "aristocrats-loop": (m, deckId) => {
    const outlet = first(m, "outlet");
    const payoff = first(m, "payoff");
    const fodder = first(m, "fodder") ?? "a creature";
    const recursion = first(m, "recursion");
    if (!outlet || !payoff) return null;
    const steps = [
      step({ cardName: payoff, from: "hand", to: "stack", action: "cast", turn: 3, phase: "main1", note: "Cast the payoff first so every later death is a trigger. (CR 601.2)", breakPoint: "A counterspell here costs you the whole turn's plan. Against open blue mana, lead with the outlet or a cheaper threat and bait the counter." }),
      step({ cardName: payoff, from: "stack", to: "battlefield", action: "resolve", turn: 3, phase: "main1" }),
      step({ cardName: outlet, from: "hand", to: "stack", action: "cast", turn: 4, phase: "main1" }),
      step({ cardName: outlet, from: "stack", to: "battlefield", action: "resolve", turn: 4, phase: "main1" }),
      step({ cardName: fodder, from: "hand", to: "battlefield", action: "cast+resolve", turn: 4, phase: "main1" }),
      step({
        cardName: fodder,
        from: "battlefield",
        to: "graveyard",
        action: "sacrifice",
        causedBy: [outlet],
        turn: 4,
        phase: "main1",
        note: "Sacrifice is a cost; it can't be responded to. The death trigger then goes on the stack. (CR 603.2, 603.6c)",
        breakPoint: "Removal aimed at the payoff in response to the trigger still lets that trigger resolve (it exists independently of its source, CR 113.7a) — but every later death is wasted. Sacrifice in response to removal, not before it.",
      }),
      step({ cardName: payoff, from: "battlefield", to: "battlefield", action: "trigger", causedBy: [fodder], turn: 4, phase: "main1", note: "Each opponent loses life / you gain life.", lifeChange: { opponent: -1, you: 1 } }),
    ];
    if (recursion) {
      steps.push(
        step({ cardName: recursion, from: "hand", to: "stack", action: "cast", turn: 5, phase: "main1" }),
        step({ cardName: fodder, from: "graveyard", to: "battlefield", action: "reanimate", causedBy: [recursion], turn: 5, phase: "main1", note: "Back to the battlefield as a new object (CR 400.7); sacrifice it again.", breakPoint: "Graveyard hate (exile in response) breaks the recursion half; the outlet + payoff still work with fresh creatures." }),
        step({ cardName: fodder, from: "battlefield", to: "graveyard", action: "sacrifice", causedBy: [outlet], turn: 5, phase: "main1", lifeChange: { opponent: -1, you: 1 } }),
      );
    }
    return { id: `${deckId}:aristocrats-loop`, title: "Aristocrats value loop", deckId, strategy: m, steps: number(steps), outcome: "Repeatable drain; opponents' life total trends to 0." };
  },

  "drain-loop": (m, deckId) => {
    const a = first(m, "gain-to-drain");
    const b = first(m, "drain-to-gain");
    const starter = first(m, "starter") ?? "any lifegain";
    if (!a || !b) return null;
    const steps = [
      step({ cardName: a, from: "hand", to: "battlefield", action: "cast+resolve", turn: 5, phase: "main1" }),
      step({ cardName: b, from: "hand", to: "battlefield", action: "cast+resolve", turn: 6, phase: "main1", note: "Both halves on the battlefield. The loop is now armed.", breakPoint: "Enchantment removal on either half at instant speed, before the loop starts, is the clean answer. Bait it with the first half a turn early if you can afford the tempo." }),
      step({
        cardName: starter,
        from: "battlefield",
        to: "battlefield",
        action: "trigger",
        turn: 6,
        phase: "main1",
        note: "Any lifegain starts the loop: gain → opponent loses → you gain → ... Each iteration is a separate trigger on the stack; the loop is mandatory and ends only when an opponent reaches 0 life (or a player breaks it). Once the loop is demonstrated, you shortcut it by announcing the outcome (MTR 4.2).",
        breakPoint: "The loop can be interrupted mid-iteration by exiling a half or by a lifegain-prevention effect; announce the shortcut clearly so opponents can respond at a defined point.",
        lifeChange: { opponent: -40, you: 40 },
      }),
    ];
    return { id: `${deckId}:drain-loop`, title: "Infinite drain loop", deckId, strategy: m, steps: number(steps), outcome: "All opponents lose the game (CR 704.5a)." };
  },

  reanimate: (m, deckId) => {
    const enabler = first(m, "enabler");
    const target = first(m, "target");
    const spell = first(m, "reanimate");
    if (!target || !spell) return null;
    const steps = [
      ...(enabler
        ? [step({ cardName: enabler, from: "hand", to: "stack", action: "cast", turn: 1, phase: "main1" }), step({ cardName: target, from: "hand", to: "graveyard", action: "discard", causedBy: [enabler], turn: 1, phase: "main1" })]
        : [step({ cardName: target, from: "hand", to: "graveyard", action: "discard", turn: 1, phase: "cleanup", note: "Hand-size discard at cleanup (CR 514.1)." })]),
      step({ cardName: spell, from: "hand", to: "stack", action: "cast", turn: 2, phase: "main1", breakPoint: "Graveyard exile in response (or a counterspell) blanks the whole turn. Hold a second target or a discard outlet to rebuild." }),
      step({ cardName: target, from: "graveyard", to: "battlefield", action: "reanimate", causedBy: [spell], turn: 2, phase: "main1", note: "Enters the battlefield as a new object; ETB triggers happen (CR 603.6a)." }),
      step({ cardName: target, from: "battlefield", to: "battlefield", action: "attack", turn: 3, phase: "declare-attackers", note: "No haste = attacks next turn. Summoning sickness (CR 302.6).", damage: 6 }),
    ];
    return { id: `${deckId}:reanimate`, title: "Turn-2 reanimation", deckId, strategy: m, steps: number(steps), outcome: "Undercosted threat online turns ahead of curve." };
  },

  "ramp-overrun": (m, deckId) => {
    const ramp1 = first(m, "ramp");
    const ramp2 = nth(m, "ramp", 1) ?? ramp1;
    const threat = first(m, "threat");
    const threat2 = nth(m, "threat", 1);
    const overrun = first(m, "overrun");
    if (!ramp1 || !threat) return null;
    const steps = [
      step({ cardName: ramp1, from: "hand", to: "battlefield", action: "cast+resolve", turn: 2, phase: "main1", note: "Ramp first: every early mana source is a turn stolen from the curve." }),
      step({ cardName: ramp2!, from: "hand", to: "battlefield", action: "cast+resolve", turn: 3, phase: "main1", breakPoint: "Dorks die to any removal or sweeper; spread ramp across land-ramp and rocks so one Pyroclasm does not reset you." }),
      step({ cardName: threat, from: "hand", to: "stack", action: "cast", turn: 4, phase: "main1", note: "A 5+-power threat two turns early. If it has trample, chump blocks stop nothing. (CR 702.19)" }),
      step({ cardName: threat, from: "stack", to: "battlefield", action: "resolve", turn: 4, phase: "main1" }),
      ...(threat2 ? [step({ cardName: threat2, from: "hand", to: "battlefield", action: "cast+resolve", turn: 5, phase: "main1" })] : []),
      step({ cardName: threat, from: "battlefield", to: "battlefield", action: "attack", turn: 5, phase: "declare-attackers", damage: 6, note: "Attack with the first threat while the second holds the ground.", breakPoint: "A blocker with deathtouch or an exile effect trades up; attack into open mana only when a second threat is already down." }),
      ...(overrun
        ? [
            step({ cardName: overrun, from: "hand", to: "stack", action: "cast", turn: 6, phase: "main1", note: "Mass pump + trample turns a board into lethal in one combat. Cast in main phase 1 so the bonus applies to attackers." }),
            step({ cardName: overrun, from: "stack", to: "graveyard", action: "resolve", turn: 6, phase: "main1" }),
            step({ cardName: "[team]", from: "battlefield", to: "battlefield", action: "attack", turn: 6, phase: "declare-attackers", damage: 20, note: "Everything attacks. Trample assigns lethal damage to blockers and the rest to the player (CR 702.19b)." }),
          ]
        : []),
    ];
    return { id: `${deckId}:ramp-overrun`, title: "Ramp into an overrun", deckId, strategy: m, steps: number(steps), outcome: overrun ? "Lethal alpha strike with mass trample." : "Oversized threats ahead of the opponent's answers." };
  },

  "prowess-turn": (m, deckId) => {
    const creature = first(m, "prowess");
    const spell1 = first(m, "spells");
    const spell2 = nth(m, "spells", 1) ?? spell1;
    const burn = first(m, "burn") ?? nth(m, "spells", 2);
    if (!creature || !spell1) return null;
    const steps = [
      step({ cardName: creature, from: "hand", to: "battlefield", action: "cast+resolve", turn: 1, phase: "main1", note: "One-drop threat. Every noncreature spell from here on is +1/+1 until end of turn." }),
      step({ cardName: spell1, from: "hand", to: "stack", action: "cast", turn: 2, phase: "main1", note: "Cast before combat: the prowess trigger resolves first, then attack for more. (CR 702.108a)" }),
      step({ cardName: creature, from: "battlefield", to: "battlefield", action: "trigger", causedBy: [spell1], turn: 2, phase: "main1", note: "Prowess: +1/+1 until end of turn." }),
      step({ cardName: spell1, from: "stack", to: "graveyard", action: "resolve", turn: 2, phase: "main1" }),
      step({ cardName: creature, from: "battlefield", to: "battlefield", action: "attack", turn: 2, phase: "declare-attackers", damage: 2, breakPoint: "Instant-speed removal in the declare-blockers step wastes the pump spell too. Against open red or black mana, attack first and pump after blocks (CR 509.1, 510.1)." }),
      step({ cardName: spell2!, from: "hand", to: "stack", action: "cast", turn: 3, phase: "declare-blockers", note: "Post-block pump or trick: the opponent has already committed blockers." }),
      step({ cardName: creature, from: "battlefield", to: "battlefield", action: "trigger", causedBy: [spell2!], turn: 3, phase: "declare-blockers" }),
      step({ cardName: spell2!, from: "stack", to: "graveyard", action: "resolve", turn: 3, phase: "declare-blockers" }),
      step({ cardName: creature, from: "battlefield", to: "battlefield", action: "attack", turn: 3, phase: "combat-damage", damage: 4 }),
      ...(burn && burn !== spell1 && burn !== spell2
        ? [step({ cardName: burn, from: "hand", to: "stack", action: "cast", turn: 4, phase: "main2", note: "Burn to the face closes the last points; count their life against your reach before committing creatures.", damage: 3 }), step({ cardName: burn, from: "stack", to: "graveyard", action: "resolve", turn: 4, phase: "main2" })]
        : []),
    ];
    return { id: `${deckId}:prowess-turn`, title: "Prowess tempo curve", deckId, strategy: m, steps: number(steps), outcome: "Fast damage plus reach; the opponent must answer the first creature or race." };
  },

  "affinity-turn": (m, deckId) => {
    const cheap = m.roles["cheap-artifacts"] ?? [];
    const payoff = first(m, "payoff");
    if (cheap.length < 2 || !payoff) return null;
    const [a1, a2, a3] = cheap;
    const steps = [
      step({ cardName: a1!, from: "hand", to: "battlefield", action: "cast+resolve", turn: 1, phase: "main1", note: "Free and one-mana artifacts first: they are the fuel every payoff counts." }),
      step({ cardName: a2!, from: "hand", to: "battlefield", action: "cast+resolve", turn: 1, phase: "main1" }),
      ...(a3 ? [step({ cardName: a3, from: "hand", to: "battlefield", action: "cast+resolve", turn: 2, phase: "main1" })] : []),
      step({ cardName: payoff, from: "hand", to: "stack", action: "cast", turn: 2, phase: "main1", note: "The payoff arrives with the board already wide; affinity / artifact-count effects scale immediately. (CR 702.41)", breakPoint: "Artifact sweepers (Shatterstorm-style) and graveyard-agnostic wipes reset the board; keep one or two artifacts in hand rather than dumping everything." }),
      step({ cardName: payoff, from: "stack", to: "battlefield", action: "resolve", turn: 2, phase: "main1" }),
      step({ cardName: payoff, from: "battlefield", to: "battlefield", action: "attack", turn: 3, phase: "declare-attackers", damage: 5, note: "Attack with the payoff; each artifact adds power." }),
    ];
    return { id: `${deckId}:affinity-turn`, title: "Artifact curve-out", deckId, strategy: m, steps: number(steps), outcome: "Board wider than the opponent's answers by turn 3." };
  },
};

export function buildPlayline(match: StrategyMatch, deckId: string): Playline | null {
  const key = PATTERN_TO_TEMPLATE[match.patternId];
  if (!key) return null;
  return TEMPLATES[key]?.(match, deckId) ?? null;
}

/** Every playline the detector's matches can animate, in match order. */
export function buildPlaylines(matches: readonly StrategyMatch[], deckId: string): Playline[] {
  const out: Playline[] = [];
  for (const m of matches) {
    const p = buildPlayline(m, deckId);
    if (p) out.push(p);
  }
  return out;
}

/** Filled from patterns.ts `playline` fields at import time to avoid a circular import. */
export const PATTERN_TO_TEMPLATE: Record<string, string> = {
  aristocrats: "aristocrats-loop",
  "lifegain-drain-loop": "drain-loop",
  reanimator: "reanimate",
  "power-ramp-stompy": "ramp-overrun",
  "prowess-tempo": "prowess-turn",
  "artifact-aggro": "affinity-turn",
};
