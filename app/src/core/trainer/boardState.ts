import type { Deck, Zone } from "../types";
import type { Timeline, TimelineStep } from "./timeline";

/**
 * Derive a board snapshot after every timeline step: which named cards sit in which zone for
 * each player, life totals, mana spent this turn, cards in hand. Purely positional bookkeeping —
 * no rules are evaluated (D-007). Unknown cards are created in their first `from` zone so a step
 * can never reference a card that is not on the board.
 */

export interface ZoneCard {
  name: string;
  /** Distinguishes several copies / tokens of the same name. */
  key: string;
  /** Tapped / attacking flags for the board renderer. */
  attacking?: boolean;
  /** Placeholder (bracketed) opponent card. */
  placeholder?: boolean;
}

export type Side = Record<Zone, ZoneCard[]>;

export interface Ledger {
  life: { you: number; opponent: number };
  /** Mana spent by the active player so far this game turn. */
  manaSpentThisTurn: number;
  cardsInHand: { you: number; opponent: number };
  /** Cumulative combat/burn damage the opponent has taken from you and vice versa. */
  damageDealt: { you: number; opponent: number };
}

export interface BoardSnapshot {
  /** Step index this snapshot follows; -1 for the initial board. */
  index: number;
  you: Side;
  opponent: Side;
  ledger: Ledger;
  /** Cards touched by this step (for highlighting), by key. */
  touched: string[];
  /** Pulse (non-moving effect) on this card key, if any. */
  pulse?: { key: string; label: string };
}

export interface BoardOptions {
  /** Starting life (20 for 60-card formats, 40 for Commander). */
  startingLife?: number;
  /** Mana value lookup for the "mana spent" ledger. */
  cmcOf?: (cardName: string) => number | undefined;
  /** Library size to show for the user (deck size minus opening hand and command zone). */
  librarySize?: number;
  /** Opponent library size (60-card default). */
  opponentLibrarySize?: number;
}

const EMPTY: () => Side = () => ({ library: [], hand: [], stack: [], battlefield: [], graveyard: [], exile: [], command: [] });

function cloneSide(s: Side): Side {
  const out = EMPTY();
  for (const z of Object.keys(s) as Zone[]) out[z] = s[z].map((c) => ({ ...c }));
  return out;
}

const isPlaceholder = (name: string) => /^\[.+\]$/.test(name);
/** Pseudo-cards that mean "the whole team" / "all your creatures" rather than one object. */
const isGroup = (name: string) => /^\[(team|all .*|your creatures)\]$/i.test(name);

/**
 * Initial zones: user commanders in the command zone; every card the playline moves *out of*
 * a zone first appears there (so a card first cast from hand starts in hand); everything else
 * in the library as an anonymous count.
 */
export function initialBoard(timeline: Timeline, deck: Pick<Deck, "commanders" | "main" | "format"> | undefined, opts: BoardOptions = {}): BoardSnapshot {
  const you = EMPTY();
  const opponent = EMPTY();
  const commanders = new Set(deck?.commanders.map((c) => c.name.toLowerCase()) ?? []);
  for (const c of deck?.commanders ?? []) you.command.push({ name: c.name, key: `you:${c.name}` });
  const seen = { you: new Set<string>(), opponent: new Set<string>() };
  for (const s of timeline.steps) {
    const side = s.actor === "you" ? you : opponent;
    const set = seen[s.actor];
    const lower = s.cardName.toLowerCase();
    if (set.has(lower) || isGroup(s.cardName)) continue;
    set.add(lower);
    if (s.actor === "you" && commanders.has(lower)) continue;
    const zone: Zone = s.from === "stack" ? "hand" : s.from;
    side[zone].push({ name: s.cardName, key: `${s.actor}:${s.cardName}`, placeholder: isPlaceholder(s.cardName) });
  }
  const deckSize = deck ? deck.main.reduce((n, e) => n + e.quantity, 0) : 60;
  const startingLife = opts.startingLife ?? (deck?.format === "commander" ? 40 : 20);
  const libYou = opts.librarySize ?? Math.max(0, deckSize - 7);
  const libOpp = opts.opponentLibrarySize ?? 53;
  you.library = Array.from({ length: Math.min(libYou, 200) }, (_, i) => ({ name: "", key: `you:lib:${i}` }));
  opponent.library = Array.from({ length: Math.min(libOpp, 200) }, (_, i) => ({ name: "", key: `opp:lib:${i}` }));
  return {
    index: -1,
    you,
    opponent,
    ledger: {
      life: { you: startingLife, opponent: startingLife },
      manaSpentThisTurn: 0,
      cardsInHand: { you: 7, opponent: 7 },
      damageDealt: { you: 0, opponent: 0 },
    },
    touched: [],
  };
}

function findCard(side: Side, name: string, zone: Zone): { zone: Zone; idx: number } | undefined {
  const lower = name.toLowerCase();
  const i = side[zone].findIndex((c) => c.name.toLowerCase() === lower);
  if (i >= 0) return { zone, idx: i };
  for (const z of Object.keys(side) as Zone[]) {
    const j = side[z].findIndex((c) => c.name.toLowerCase() === lower);
    if (j >= 0) return { zone: z, idx: j };
  }
  return undefined;
}

/** Apply one step to a snapshot (pure; returns a new snapshot). */
export function applyStep(prev: BoardSnapshot, step: TimelineStep, opts: BoardOptions = {}, prevStep?: TimelineStep): BoardSnapshot {
  const you = cloneSide(prev.you);
  const opponent = cloneSide(prev.opponent);
  const side = step.actor === "you" ? you : opponent;
  const ledger: Ledger = {
    life: { ...prev.ledger.life },
    manaSpentThisTurn: prevStep && prevStep.gameTurn !== step.gameTurn ? 0 : prev.ledger.manaSpentThisTurn,
    cardsInHand: { ...prev.ledger.cardsInHand },
    damageDealt: { ...prev.ledger.damageDealt },
  };
  const touched: string[] = [];
  let pulse: BoardSnapshot["pulse"];
  const action = step.action.toLowerCase();

  // Clear attackers at the start of a new game turn.
  if (prevStep && prevStep.gameTurn !== step.gameTurn) {
    for (const s of [you, opponent]) for (const c of s.battlefield) c.attacking = false;
  }

  if (isGroup(step.cardName)) {
    // Whole-team effects: attack marks every creature; destroy empties the (other) battlefield.
    if (action.includes("attack")) {
      for (const c of side.battlefield) {
        c.attacking = true;
        touched.push(c.key);
      }
    } else if (action.includes("destroy") || action.includes("sweep")) {
      const victim = step.actor === "you" ? opponent : you;
      const target = /your/i.test(step.cardName) ? (step.actor === "you" ? you : opponent) : victim;
      // "[all your creatures]" on an opponent step refers to *your* creatures.
      const dying = /your/i.test(step.cardName) && step.actor === "opponent" ? you : target;
      const moved = dying.battlefield.splice(0, dying.battlefield.length);
      for (const c of moved) {
        c.attacking = false;
        dying.graveyard.push(c);
        touched.push(c.key);
      }
    }
  } else if (step.from === step.to) {
    const found = findCard(side, step.cardName, step.from);
    if (found) {
      const card = side[found.zone][found.idx]!;
      touched.push(card.key);
      if (action.includes("attack")) card.attacking = true;
      else pulse = { key: card.key, label: step.note?.split(/[.(]/)[0]?.trim() || step.action };
    }
  } else {
    const found = findCard(side, step.cardName, step.from);
    let card: ZoneCard;
    if (found) {
      card = side[found.zone].splice(found.idx, 1)[0]!;
    } else if (step.from === "library") {
      const anon = side.library.pop();
      card = { name: step.cardName, key: anon ? anon.key : `${step.actor}:${step.cardName}:${step.index}`, placeholder: isPlaceholder(step.cardName) };
    } else {
      card = { name: step.cardName, key: `${step.actor}:${step.cardName}:${step.index}`, placeholder: isPlaceholder(step.cardName) };
    }
    card.attacking = false;
    if (step.to === "library") side.library.push({ name: "", key: card.key });
    else side[step.to].push(card);
    touched.push(card.key);
  }

  // Ledger.
  const actorKey = step.actor;
  const otherKey = step.actor === "you" ? "opponent" : "you";
  if (step.from === "hand" && step.to !== "hand") ledger.cardsInHand[actorKey] = Math.max(0, ledger.cardsInHand[actorKey] - 1);
  if (step.to === "hand" && step.from !== "hand") ledger.cardsInHand[actorKey] += 1;
  if (action === "cast" || action === "cast+resolve" || action === "play-land") {
    const mana = step.manaSpent ?? (action === "play-land" ? 0 : (opts.cmcOf?.(step.cardName) ?? 0));
    ledger.manaSpentThisTurn += mana;
  }
  if (step.damage) {
    ledger.life[otherKey] -= step.damage;
    ledger.damageDealt[actorKey] += step.damage;
  }
  if (step.lifeChange) {
    if (step.lifeChange.you) ledger.life.you += step.lifeChange.you;
    if (step.lifeChange.opponent) ledger.life.opponent += step.lifeChange.opponent;
  }
  return { index: step.index, you, opponent, ledger, touched, pulse };
}

/** Snapshot after each step, plus the initial board at position 0. */
export function deriveSnapshots(timeline: Timeline, deck: Pick<Deck, "commanders" | "main" | "format"> | undefined, opts: BoardOptions = {}): BoardSnapshot[] {
  const out: BoardSnapshot[] = [initialBoard(timeline, deck, opts)];
  timeline.steps.forEach((s, i) => out.push(applyStep(out[i]!, s, opts, i > 0 ? timeline.steps[i - 1] : undefined)));
  return out;
}
