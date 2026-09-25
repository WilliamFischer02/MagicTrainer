import type { Format, Playline, StrategyMatch, TrajectoryStep } from "../types";

/**
 * Playline templates turn a StrategyMatch into an animated sequence of zone transitions.
 * They are deliberately schematic: they do not evaluate rules or mana. Each template picks
 * concrete card names out of the match's role buckets so the board shows the player's own cards,
 * and derives damage from the named creatures' printed power when the caller can supply it
 * (`TemplateOptions.powerOf`) — never from a made-up constant.
 *
 * Rule citations in notes reference the Comprehensive Rules bundled in knowledge/mtg-rules/
 * (verified present 2026-09-25: 113.7a, 302.6, 400.7, 509.1, 510.1, 514.1, 601.2, 601.2h, 602.2b,
 * 603.6a, 603.6c, 702.19, 702.19b, 702.41, 702.108a, 704.5a; MTR 4.4 "Loops"). `breakPoint` is the
 * training payload: the interaction that most often stops the step, and what to do instead.
 * Reviewed by the rules-judge and strategy-analyst passes on 2026-09-25.
 */

export interface TemplateOptions {
  /** True when the named card is a permanent (creature/artifact/enchantment/planeswalker/land). Unknown → treated as a permanent. */
  isPermanent?: (cardName: string) => boolean | undefined;
  /** Printed power of a creature by name; undefined when unknown or not a creature. */
  powerOf?: (cardName: string) => number | undefined;
  /** Keyword check (e.g. "Haste", "Trample", "Prowess") by card name. */
  hasKeyword?: (cardName: string, keyword: string) => boolean;
  /** Deck format: Commander lines speak of "each opponent" and 40 life. */
  format?: Format;
  /** True when the named card is one of the deck's commanders (cast from the command zone, CR 903.8). */
  isCommander?: (cardName: string) => boolean;
}

type Template = (m: StrategyMatch, deckId: string, opts: TemplateOptions) => Playline | null;

let currentOpts: TemplateOptions = {};
const isCommander = () => currentOpts.format === "commander";
const oppWord = () => (isCommander() ? "each opponent" : "the opponent");
const cap = (t: string) => t.charAt(0).toUpperCase() + t.slice(1);
const power = (name: string | undefined): number | undefined => (name ? currentOpts.powerOf?.(name) : undefined);
const hasKw = (name: string | undefined, kw: string): boolean => (name ? (currentOpts.hasKeyword?.(name, kw) ?? false) : false);
const resolveZone = (name: string): "graveyard" | "battlefield" => (currentOpts.isPermanent?.(name) === false ? "graveyard" : "battlefield");
/** Commanders are cast from the command zone; everything else from hand. */
const castFrom = (name: string): "hand" | "command" => (currentOpts.isCommander?.(name) ? "command" : "hand");

/** First role member; with `permanent`, the first member that is (or may be) a permanent. */
const first = (m: StrategyMatch, role: string, permanent = false) => {
  const names = m.roles[role] ?? [];
  if (!permanent || !currentOpts.isPermanent) return names[0];
  return names.find((n) => currentOpts.isPermanent!(n) !== false) ?? names[0];
};
const nth = (m: StrategyMatch, role: string, i: number, permanent = false) => {
  const names = m.roles[role] ?? [];
  if (!permanent || !currentOpts.isPermanent) return names[i];
  const perms = names.filter((n) => currentOpts.isPermanent!(n) !== false);
  return perms[i] ?? names[i];
};
/** Creatures of a role sorted by power (desc); unknown power sorts last. */
const byPower = (m: StrategyMatch, role: string): string[] => [...(m.roles[role] ?? [])].sort((a, b) => (power(b) ?? -1) - (power(a) ?? -1));

function step(partial: Omit<TrajectoryStep, "step" | "actor"> & { actor?: "you" | "opponent" }): TrajectoryStep {
  return { step: 0, actor: partial.actor ?? "you", ...partial };
}

function number(steps: TrajectoryStep[]): TrajectoryStep[] {
  return steps.map((s, i) => ({ ...s, step: i + 1 }));
}

function sum(values: (number | undefined)[]): number | undefined {
  const known = values.filter((v): v is number => v !== undefined);
  return known.length ? known.reduce((a, b) => a + b, 0) : undefined;
}

export const TEMPLATES: Record<string, Template> = {
  "aristocrats-loop": (m, deckId) => {
    const outlet = first(m, "outlet", true);
    const payoff = first(m, "payoff", true);
    const fodder = first(m, "fodder", true) ?? "a creature";
    const recursion = first(m, "recursion");
    if (!outlet || !payoff) return null;
    const drain = { opponent: -1, you: 1 };
    const steps = [
      step({ cardName: payoff, from: castFrom(payoff), to: "stack", action: "cast", turn: 3, phase: "main1", note: "Cast the payoff first so every later death is a trigger. Casting a spell puts it on the stack (CR 601.2).", breakPoint: "A counterspell here costs you the whole turn's plan. Against open blue mana, lead with the outlet or a cheaper threat and bait the counter." }),
      step({ cardName: payoff, from: "stack", to: resolveZone(payoff), action: "resolve", turn: 3, phase: "main1" }),
      step({ cardName: outlet, from: castFrom(outlet), to: "stack", action: "cast", turn: 4, phase: "main1" }),
      step({ cardName: outlet, from: "stack", to: resolveZone(outlet), action: "resolve", turn: 4, phase: "main1" }),
      step({ cardName: fodder, from: castFrom(fodder), to: "battlefield", action: "cast+resolve", turn: 4, phase: "main1" }),
      step({
        cardName: fodder,
        from: "battlefield",
        to: "graveyard",
        action: "sacrifice",
        causedBy: [outlet],
        turn: 4,
        phase: "main1",
        note: "The sacrifice is a cost of activating the outlet: costs are paid as part of activation, before anyone receives priority (CR 602.2b, CR 601.2h), so nobody can respond to the sacrifice itself. The creature leaving the battlefield then triggers the payoff (CR 603.6c).",
        breakPoint: "Removal aimed at the payoff in response to the trigger does not stop that trigger — once on the stack it exists independently of its source (CR 113.7a) — but every later death is wasted. Sacrifice in response to removal, not before it.",
      }),
      step({ cardName: payoff, from: "battlefield", to: "battlefield", action: "trigger", causedBy: [fodder], turn: 4, phase: "main1", note: `${cap(oppWord())} loses 1 life and you gain 1 life.`, lifeChange: drain }),
    ];
    if (recursion) {
      steps.push(
        step({ cardName: recursion, from: castFrom(recursion), to: "stack", action: "cast", turn: 5, phase: "main1" }),
        step({ cardName: fodder, from: "graveyard", to: "battlefield", action: "reanimate", causedBy: [recursion], turn: 5, phase: "main1", note: "Back to the battlefield as a new object with no memory of its last life (CR 400.7); sacrifice it again.", breakPoint: "Graveyard hate (exile in response) breaks the recursion half; the outlet + payoff still work with fresh creatures." }),
        step({ cardName: recursion, from: "stack", to: resolveZone(recursion), action: "resolve", turn: 5, phase: "main1" }),
        step({ cardName: fodder, from: "battlefield", to: "graveyard", action: "sacrifice", causedBy: [outlet], turn: 5, phase: "main1", lifeChange: drain }),
      );
    }
    return { id: `${deckId}:aristocrats-loop`, title: "Aristocrats value loop", deckId, strategy: m, steps: number(steps), outcome: `Repeatable drain; ${oppWord()}'s life total trends to 0.` };
  },

  "drain-loop": (m, deckId) => {
    const a = first(m, "gain-to-drain");
    const b = first(m, "drain-to-gain");
    const starter = first(m, "starter") ?? "any lifegain";
    if (!a || !b) return null;
    const life = isCommander() ? 40 : 20;
    const steps = [
      step({ cardName: a, from: castFrom(a), to: "battlefield", action: "cast+resolve", turn: 5, phase: "main1" }),
      step({ cardName: b, from: castFrom(b), to: "battlefield", action: "cast+resolve", turn: 6, phase: "main1", note: "Both halves on the battlefield. The loop is now armed.", breakPoint: "Enchantment removal on either half at instant speed, before the loop starts, is the clean answer. Bait it with the first half a turn early if you can afford the tempo." }),
      step({
        cardName: starter,
        from: "battlefield",
        to: "battlefield",
        action: "trigger",
        turn: 6,
        phase: "main1",
        note: `Any lifegain starts the loop: gain → ${oppWord()} loses → you gain → … Each iteration is a separate trigger on the stack; the loop is mandatory and ends only when ${oppWord()} reaches 0 life or a player breaks it. In a tournament you demonstrate one iteration and propose a shortcut for the rest (MTR 4.4).`,
        breakPoint: "The loop can be interrupted mid-iteration by exiling a half or by a lifegain-prevention effect; announce the shortcut clearly so opponents can respond at a defined point.",
        lifeChange: { opponent: -life, you: life },
      }),
    ];
    return { id: `${deckId}:drain-loop`, title: "Infinite drain loop", deckId, strategy: m, steps: number(steps), outcome: `${isCommander() ? "All opponents lose" : "The opponent loses"} the game at 0 life (CR 704.5a).` };
  },

  reanimate: (m, deckId) => {
    const enabler = first(m, "enabler");
    const target = byPower(m, "target")[0];
    const spell = first(m, "reanimate");
    if (!target || !spell) return null;
    const steps = [
      ...(enabler
        ? [step({ cardName: enabler, from: "hand", to: "stack", action: "cast", turn: 1, phase: "main1" }), step({ cardName: target, from: "hand", to: "graveyard", action: "discard", causedBy: [enabler], turn: 1, phase: "main1" })]
        : [step({ cardName: target, from: "hand", to: "graveyard", action: "discard", turn: 1, phase: "cleanup", note: "Hand-size discard at cleanup (CR 514.1)." })]),
      step({ cardName: spell, from: "hand", to: "stack", action: "cast", turn: 2, phase: "main1", breakPoint: "Graveyard exile in response (or a counterspell) blanks the whole turn. Hold a second target or a discard outlet to rebuild." }),
      step({ cardName: target, from: "graveyard", to: "battlefield", action: "reanimate", causedBy: [spell], turn: 2, phase: "main1", note: "Enters as a new object (CR 400.7); its enters-the-battlefield abilities trigger (CR 603.6a)." }),
      step({ cardName: target, from: "battlefield", to: "battlefield", action: "attack", turn: 3, phase: "declare-attackers", note: hasKw(target, "Haste") ? "Haste: it could have attacked the turn it arrived." : "No haste, so it attacks next turn: a creature can't attack unless it has been under your control continuously since your most recent turn began (CR 302.6).", damage: power(target) }),
    ];
    return { id: `${deckId}:reanimate`, title: "Turn-2 reanimation", deckId, strategy: m, steps: number(steps), outcome: "Undercosted threat online turns ahead of curve." };
  },

  "ramp-overrun": (m, deckId) => {
    const ramp1 = first(m, "ramp", true);
    const ramp2 = nth(m, "ramp", 1, true) ?? ramp1;
    const threats = byPower(m, "threat");
    const threat = threats[0];
    const threat2 = threats[1];
    const overrun = first(m, "overrun");
    if (!ramp1 || !threat) return null;
    const cmd = isCommander();
    const t = (n: number) => (cmd ? n + 1 : n); // Commander tables develop and punish a turn slower
    const teamPower = sum([power(threat), power(threat2)]);
    const steps = [
      step({ cardName: ramp1, from: castFrom(ramp1), to: "battlefield", action: "cast+resolve", turn: t(2), phase: "main1", note: "Ramp first: every early mana source is a turn stolen from the curve." }),
      step({ cardName: ramp2!, from: "hand", to: "battlefield", action: "cast+resolve", turn: t(3), phase: "main1", breakPoint: "Dorks die to any removal or sweeper; spread ramp across land-ramp and rocks so one Pyroclasm does not reset you." }),
      step({ cardName: threat, from: castFrom(threat), to: "stack", action: "cast", turn: t(4), phase: "main1", note: `${power(threat) ? `A ${power(threat)}-power threat` : "A big threat"} two turns early.${hasKw(threat, "Trample") ? " Trample means chump blocks stop nothing (CR 702.19)." : ""}` }),
      step({ cardName: threat, from: "stack", to: "battlefield", action: "resolve", turn: t(4), phase: "main1" }),
      ...(threat2 ? [step({ cardName: threat2, from: castFrom(threat2), to: "battlefield", action: "cast+resolve", turn: t(5), phase: "main1" })] : []),
      step({ cardName: threat, from: "battlefield", to: "battlefield", action: "attack", turn: t(5), phase: "declare-attackers", damage: power(threat), note: "Attack with the first threat while the second holds the ground.", breakPoint: "A blocker with deathtouch or an exile effect trades up; attack into open mana only when a second threat is already down." }),
      ...(overrun
        ? [
            step({ cardName: overrun, from: "hand", to: "stack", action: "cast", turn: t(6), phase: "main1", note: "Mass pump + trample turns a board into lethal in one combat. Cast in main phase 1 so the bonus applies to attackers." }),
            step({ cardName: overrun, from: "stack", to: resolveZone(overrun), action: "resolve", turn: t(6), phase: "main1" }),
            step({ cardName: "[team]", from: "battlefield", to: "battlefield", action: "attack", turn: t(6), phase: "declare-attackers", damage: teamPower, note: `Everything attacks${teamPower ? ` for ${teamPower} before the pump` : ""}. Trample assigns lethal damage to blockers and the rest to the player (CR 702.19b).${cmd ? " At a Commander table this is aimed at the most dangerous opponent, not all three at once." : ""}` }),
          ]
        : []),
    ];
    return { id: `${deckId}:ramp-overrun`, title: "Ramp into an overrun", deckId, strategy: m, steps: number(steps), outcome: overrun ? "Lethal alpha strike with mass trample." : "Oversized threats ahead of the opponent's answers." };
  },

  "prowess-turn": (m, deckId) => {
    const creature = first(m, "prowess", true);
    const spell1 = first(m, "spells");
    const spell2 = nth(m, "spells", 1) ?? spell1;
    const burn = first(m, "burn") ?? nth(m, "spells", 2);
    if (!creature || !spell1) return null;
    const p = power(creature);
    const haste = hasKw(creature, "Haste");
    const steps = [
      step({ cardName: creature, from: "hand", to: "battlefield", action: "cast+resolve", turn: 1, phase: "main1", note: `One-drop threat.${haste ? " It has haste: attack this turn." : ""} Every noncreature spell from here on is +1/+1 until end of turn.` }),
      ...(haste ? [step({ cardName: creature, from: "battlefield", to: "battlefield", action: "attack", turn: 1, phase: "declare-attackers", damage: p, note: "Haste lets it attack the turn it enters (the restriction in CR 302.6 does not apply)." })] : []),
      step({ cardName: spell1, from: "hand", to: "stack", action: "cast", turn: 2, phase: "main1", note: "Cast before combat: the prowess trigger resolves first, then attack for more (CR 702.108a)." }),
      step({ cardName: creature, from: "battlefield", to: "battlefield", action: "trigger", causedBy: [spell1], turn: 2, phase: "main1", note: "Prowess: +1/+1 until end of turn." }),
      step({ cardName: spell1, from: "stack", to: "graveyard", action: "resolve", turn: 2, phase: "main1" }),
      step({ cardName: creature, from: "battlefield", to: "battlefield", action: "attack", turn: 2, phase: "declare-attackers", damage: p !== undefined ? p + 1 : undefined, breakPoint: "Instant-speed removal in the declare-blockers step wastes the pump spell too. Against open red or black mana, attack first and pump after blocks (CR 509.1, 510.1)." }),
      step({ cardName: spell2!, from: "hand", to: "stack", action: "cast", turn: 3, phase: "declare-blockers", note: "Post-block pump or trick: the opponent has already committed blockers." }),
      step({ cardName: creature, from: "battlefield", to: "battlefield", action: "trigger", causedBy: [spell2!], turn: 3, phase: "declare-blockers" }),
      step({ cardName: spell2!, from: "stack", to: "graveyard", action: "resolve", turn: 3, phase: "declare-blockers" }),
      step({ cardName: creature, from: "battlefield", to: "battlefield", action: "attack", turn: 3, phase: "combat-damage", damage: p !== undefined ? p + 1 : undefined }),
      ...(burn && burn !== spell1 && burn !== spell2
        ? [step({ cardName: burn, from: "hand", to: "stack", action: "cast", turn: 4, phase: "main2", note: "Burn to the face closes the last points; count their life against your reach before committing creatures." }), step({ cardName: burn, from: "stack", to: "graveyard", action: "resolve", turn: 4, phase: "main2" })]
        : []),
    ];
    return { id: `${deckId}:prowess-turn`, title: "Prowess tempo curve", deckId, strategy: m, steps: number(steps), outcome: "Fast damage plus reach; the opponent must answer the first creature or race." };
  },

  "affinity-turn": (m, deckId) => {
    const cheap = m.roles["cheap-artifacts"] ?? [];
    const payoff = first(m, "payoff", true);
    if (cheap.length < 2 || !payoff) return null;
    const creatures = cheap.filter((n) => power(n) !== undefined);
    const [a1, a2, a3] = cheap;
    const boardPower = sum([...creatures.slice(0, 3).map(power), power(payoff)]);
    const steps = [
      step({ cardName: a1!, from: "hand", to: "battlefield", action: "cast+resolve", turn: 1, phase: "main1", note: "Free and one-mana artifacts first: they are the fuel every payoff counts." }),
      step({ cardName: a2!, from: "hand", to: "battlefield", action: "cast+resolve", turn: 1, phase: "main1" }),
      ...(a3 ? [step({ cardName: a3, from: "hand", to: "battlefield", action: "cast+resolve", turn: 1, phase: "main1" })] : []),
      step({ cardName: payoff, from: "hand", to: "stack", action: "cast", turn: 2, phase: "main1", note: "The payoff arrives with the board already wide; affinity / artifact-count effects scale immediately (CR 702.41).", breakPoint: "Artifact sweepers (Shatterstorm-style) and cheap artifact removal reset the board; keep one or two artifacts in hand rather than dumping everything." }),
      step({ cardName: payoff, from: "stack", to: "battlefield", action: "resolve", turn: 2, phase: "main1" }),
      step({ cardName: "[team]", from: "battlefield", to: "battlefield", action: "attack", turn: 2, phase: "declare-attackers", damage: boardPower, note: `Everything attacks on turn 2${boardPower ? ` for ${boardPower} printed power` : ""}; artifact-count bonuses (a lord, an equipment that counts artifacts) add more on top. Affinity kills on turn 3 or 4 when it is not answered.` }),
      step({ cardName: "[team]", from: "battlefield", to: "battlefield", action: "attack", turn: 3, phase: "declare-attackers", damage: boardPower, breakPoint: "Decision point: a single sweeper on their turn 3 is the loss. Against open mana with a sweeper deck, hold back the last one or two artifacts to rebuild." }),
    ];
    return { id: `${deckId}:affinity-turn`, title: "Artifact curve-out", deckId, strategy: m, steps: number(steps), outcome: "Board wider than the opponent's answers by turn 3." };
  },

  "curve-out": (m, deckId) => {
    const threats = byPower(m, "cheap-threats");
    if (threats.length < 3) return null;
    const [c1, c2, c3] = threats;
    const trick = first(m, "tricks");
    const reach = first(m, "reach");
    const removal = first(m, "removal");
    const p1 = power(c1);
    const p2 = power(c2);
    const p3 = power(c3);
    const steps = [
      step({ cardName: c1!, from: "hand", to: "battlefield", action: "cast+resolve", turn: 1, phase: "main1", note: "Turn-1 creature: aggro wins by being the beatdown from the first turn. Every turn they do not answer you, they fall further behind." }),
      step({ cardName: c2!, from: "hand", to: "battlefield", action: "cast+resolve", turn: 2, phase: "main1" }),
      step({ cardName: c1!, from: "battlefield", to: "battlefield", action: "attack", turn: 2, phase: "declare-attackers", damage: p1, breakPoint: "Do not attack a 2/2 into an untapped 2/2 without a trick in hand; the trade costs you the tempo the whole deck is built on." }),
      step({ cardName: c3!, from: "hand", to: "battlefield", action: "cast+resolve", turn: 3, phase: "main1" }),
      ...(removal ? [step({ cardName: removal, from: "hand", to: "stack", action: "cast", turn: 3, phase: "main1", note: "Cheap removal on the one blocker that matters, then attack." }), step({ cardName: removal, from: "stack", to: resolveZone(removal), action: "resolve", turn: 3, phase: "main1" })] : []),
      step({ cardName: "[team]", from: "battlefield", to: "battlefield", action: "attack", turn: 3, phase: "declare-attackers", damage: sum([p1, p2]), note: "Two attackers; the fresh creature stays home (summoning sickness, CR 302.6)." }),
      ...(trick ? [step({ cardName: trick, from: "hand", to: "stack", action: "cast", turn: 3, phase: "declare-blockers", note: "After blockers: the trick wins the combat they thought was safe.", breakPoint: "A removal spell in response to the trick is the classic two-for-one. Against open mana, attack with the creature you can afford to lose and keep the trick for the creature that must connect." }), step({ cardName: trick, from: "stack", to: resolveZone(trick), action: "resolve", turn: 3, phase: "declare-blockers" })] : []),
      step({ cardName: "[team]", from: "battlefield", to: "battlefield", action: "attack", turn: 4, phase: "declare-attackers", damage: sum([p1, p2, p3]), breakPoint: "Decision point: by turn 4 aggro must be ahead on life. If they have stabilized, stop trading creatures into blockers and switch to burn and evasion." }),
      ...(reach ? [step({ cardName: reach, from: "hand", to: "stack", action: "cast", turn: 4, phase: "main2", note: "Reach: the last points come from burn, not from combat." }), step({ cardName: reach, from: "stack", to: "graveyard", action: "resolve", turn: 4, phase: "main2" })] : []),
    ];
    return { id: `${deckId}:curve-out`, title: "Aggro curve-out", deckId, strategy: m, steps: number(steps), outcome: "Lethal by turn 4–5 if the opponent stumbles; otherwise switch to reach." };
  },

  "stompy-turn": (m, deckId) => {
    const beaters = byPower(m, "beaters");
    const pump = first(m, "pump");
    const pump2 = nth(m, "pump", 1);
    const protection = first(m, "protection");
    if (beaters.length < 2 || !pump) return null;
    const [b1, b2] = beaters;
    const p1 = power(b1);
    const p2 = power(b2);
    const steps = [
      step({ cardName: b1!, from: "hand", to: "battlefield", action: "cast+resolve", turn: 1, phase: "main1", note: `Undercosted beater on turn 1${p1 ? ` (${p1} power for one mana)` : ""}. Stompy is a curve deck: no ramp, just the best rate at every mana value.` }),
      step({ cardName: b2!, from: "hand", to: "battlefield", action: "cast+resolve", turn: 2, phase: "main1" }),
      step({ cardName: b1!, from: "battlefield", to: "battlefield", action: "attack", turn: 2, phase: "declare-attackers", damage: p1 }),
      step({ cardName: "[team]", from: "battlefield", to: "battlefield", action: "attack", turn: 3, phase: "declare-attackers", damage: sum([p1, p2]), note: "Attack with both; pump spells make any block a losing one." }),
      step({ cardName: pump, from: "hand", to: "stack", action: "cast", turn: 3, phase: "declare-blockers", note: "After blockers are declared: the pump kills the blocker or pushes damage through (CR 509.1, 510.1).", breakPoint: "The most common blowout: removal in response to the pump, losing the creature AND the spell. Against open removal mana, pump only when it wins the game or when they are tapped out." }),
      step({ cardName: pump, from: "stack", to: resolveZone(pump), action: "resolve", turn: 3, phase: "declare-blockers" }),
      ...(protection ? [step({ cardName: protection, from: "hand", to: "stack", action: "cast", turn: 4, phase: "main1", note: "Hexproof or protection tricks keep the one big creature alive through the removal turn.", breakPoint: "Sweepers do not target: protection tricks do nothing against them. Against a sweeper deck, hold the second and third beaters in hand." }), step({ cardName: protection, from: "stack", to: resolveZone(protection), action: "resolve", turn: 4, phase: "main1" })] : []),
      step({ cardName: "[team]", from: "battlefield", to: "battlefield", action: "attack", turn: 4, phase: "declare-attackers", damage: sum([p1, p2]), note: "Keep attacking; the pump-after-blocks pattern repeats every combat." }),
      ...(pump2 && pump2 !== pump ? [step({ cardName: pump2, from: "hand", to: "stack", action: "cast", turn: 4, phase: "declare-blockers" }), step({ cardName: pump2, from: "stack", to: resolveZone(pump2), action: "resolve", turn: 4, phase: "declare-blockers" })] : []),
    ];
    return { id: `${deckId}:stompy-turn`, title: "Stompy: beaters and pump", deckId, strategy: m, steps: number(steps), outcome: "Two-turn clock from turn 3; every pump is a removal spell for their blocker." };
  },
};

export function buildPlayline(match: StrategyMatch, deckId: string, opts: TemplateOptions = {}): Playline | null {
  const key = PATTERN_TO_TEMPLATE[match.patternId];
  if (!key) return null;
  currentOpts = opts;
  try {
    return TEMPLATES[key]?.(match, deckId, opts) ?? null;
  } finally {
    currentOpts = {};
  }
}

/** Every playline the detector's matches can animate, in match order. */
export function buildPlaylines(matches: readonly StrategyMatch[], deckId: string, opts: TemplateOptions = {}): Playline[] {
  const out: Playline[] = [];
  for (const m of matches) {
    const p = buildPlayline(m, deckId, opts);
    if (p) out.push(p);
  }
  return out;
}

/** Permanent test from a Scryfall type line. */
export function isPermanentType(typeLine: string | undefined): boolean | undefined {
  if (!typeLine) return undefined;
  const front = typeLine.split(" // ")[0] ?? typeLine;
  return /\b(Creature|Artifact|Enchantment|Planeswalker|Land|Battle)\b/.test(front);
}

/** Printed power as a number ("*" and "1+*" → undefined). */
export function printedPower(power: string | undefined): number | undefined {
  if (power === undefined) return undefined;
  const n = Number(power);
  return Number.isFinite(n) ? n : undefined;
}

/** Filled from patterns.ts `playline` fields at import time to avoid a circular import. */
export const PATTERN_TO_TEMPLATE: Record<string, string> = {
  aristocrats: "aristocrats-loop",
  "lifegain-drain-loop": "drain-loop",
  reanimator: "reanimate",
  "power-ramp-stompy": "ramp-overrun",
  "prowess-tempo": "prowess-turn",
  "artifact-aggro": "affinity-turn",
  "creature-aggro": "curve-out",
  stompy: "stompy-turn",
};
