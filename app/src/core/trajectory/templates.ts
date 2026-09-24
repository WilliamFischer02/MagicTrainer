import type { Playline, StrategyMatch, TrajectoryStep } from "../types";

/**
 * Playline templates turn a StrategyMatch into an animated sequence of zone transitions.
 * They are deliberately schematic: they do not evaluate rules or mana. Each template picks
 * concrete card names out of the match's role buckets so the board shows the player's own cards.
 *
 * Rule citations in notes reference the Comprehensive Rules bundled in knowledge/mtg-rules/.
 */

type Template = (m: StrategyMatch, deckId: string) => Playline | null;

const first = (m: StrategyMatch, role: string) => m.roles[role]?.[0];

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
      step({ cardName: payoff, from: "hand", to: "stack", action: "cast", turn: 3, phase: "main1", note: "Cast the payoff first so every later death is a trigger. (CR 601.2)" }),
      step({ cardName: payoff, from: "stack", to: "battlefield", action: "resolve", turn: 3, phase: "main1" }),
      step({ cardName: outlet, from: "hand", to: "stack", action: "cast", turn: 4, phase: "main1" }),
      step({ cardName: outlet, from: "stack", to: "battlefield", action: "resolve", turn: 4, phase: "main1" }),
      step({ cardName: fodder, from: "hand", to: "battlefield", action: "cast+resolve", turn: 4, phase: "main1" }),
      step({ cardName: fodder, from: "battlefield", to: "graveyard", action: "sacrifice", causedBy: [outlet], turn: 4, phase: "main1", note: "Sacrifice is a cost; it can't be responded to. The death trigger then goes on the stack. (CR 603.2, 603.6c)" }),
      step({ cardName: payoff, from: "battlefield", to: "battlefield", action: "trigger", causedBy: [fodder], turn: 4, phase: "main1", note: "Each opponent loses life / you gain life." }),
    ];
    if (recursion) {
      steps.push(
        step({ cardName: recursion, from: "hand", to: "stack", action: "cast", turn: 5, phase: "main1" }),
        step({ cardName: fodder, from: "graveyard", to: "battlefield", action: "reanimate", causedBy: [recursion], turn: 5, phase: "main1", note: "Back to the battlefield as a new object (CR 400.7); sacrifice it again." }),
        step({ cardName: fodder, from: "battlefield", to: "graveyard", action: "sacrifice", causedBy: [outlet], turn: 5, phase: "main1" }),
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
      step({ cardName: b, from: "hand", to: "battlefield", action: "cast+resolve", turn: 6, phase: "main1", note: "Both halves on the battlefield. The loop is now armed." }),
      step({ cardName: starter, from: "battlefield", to: "battlefield", action: "trigger", turn: 6, phase: "main1", note: "Any lifegain starts the loop: gain → opponent loses → you gain → ... Each iteration is a separate trigger on the stack; the loop is mandatory and ends only when an opponent reaches 0 life (or a player breaks it). Once the loop is demonstrated, you shortcut it by announcing the outcome (MTR 4.2)." }),
    ];
    return { id: `${deckId}:drain-loop`, title: "Infinite drain loop", deckId, strategy: m, steps: number(steps), outcome: "All opponents lose the game (CR 704.5a)." };
  },

  reanimate: (m, deckId) => {
    const enabler = first(m, "enabler");
    const target = first(m, "target");
    const spell = first(m, "reanimate");
    if (!target || !spell) return null;
    const steps = [
      ...(enabler ? [step({ cardName: enabler, from: "hand", to: "stack", action: "cast", turn: 1, phase: "main1" }), step({ cardName: target, from: "hand", to: "graveyard", action: "discard", causedBy: [enabler], turn: 1, phase: "main1" })] : [step({ cardName: target, from: "hand", to: "graveyard", action: "discard", turn: 1, phase: "cleanup", note: "Hand-size discard at cleanup (CR 514.1)." })]),
      step({ cardName: spell, from: "hand", to: "stack", action: "cast", turn: 2, phase: "main1" }),
      step({ cardName: target, from: "graveyard", to: "battlefield", action: "reanimate", causedBy: [spell], turn: 2, phase: "main1", note: "Enters the battlefield as a new object; ETB triggers happen (CR 603.6a)." }),
      step({ cardName: target, from: "battlefield", to: "battlefield", action: "attack", turn: 3, phase: "declare-attackers", note: "No haste = attacks next turn. Summoning sickness (CR 302.6)." }),
    ];
    return { id: `${deckId}:reanimate`, title: "Turn-2 reanimation", deckId, strategy: m, steps: number(steps), outcome: "Undercosted threat online turns ahead of curve." };
  },
};

export function buildPlayline(match: StrategyMatch, deckId: string): Playline | null {
  const key = PATTERN_TO_TEMPLATE[match.patternId];
  if (!key) return null;
  return TEMPLATES[key]?.(match, deckId) ?? null;
}

/** Filled from patterns.ts `playline` fields at import time to avoid a circular import. */
export const PATTERN_TO_TEMPLATE: Record<string, string> = {
  aristocrats: "aristocrats-loop",
  "lifegain-drain-loop": "drain-loop",
  reanimator: "reanimate",
};
