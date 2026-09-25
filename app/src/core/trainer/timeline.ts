import { PHASES } from "../opponent/schema";
import type { OpponentTrack, Phase, Playline, TrajectoryStep } from "../types";

/**
 * Merge the user's playline with an opponent track into one ordered timeline.
 * Rule (`docs/OPPONENT_TRACKS.md`): sort by (game turn, phase, actor order, step); the active
 * player's own actions come first in their own turn. Turn numbers in playlines and tracks are
 * *player* turns (your turn 3, their turn 3); the game alternates them, so with the user on the
 * play the order is you-1, opp-1, you-2, opp-2 … and on the draw it is opp-1, you-1, ….
 */

export interface TimelineStep extends TrajectoryStep {
  /** 0-based position in the merged timeline. */
  index: number;
  /** Game turn counter across both players (1 = first turn of the game). */
  gameTurn: number;
  /** Which player's turn this game turn is. */
  activePlayer: "you" | "opponent";
  /** Original playline / track id for the step panel. */
  sourceId: string;
}

export interface Timeline {
  steps: TimelineStep[];
  /** Turn markers for the scrubber: first step index of each game turn. */
  turns: { gameTurn: number; activePlayer: "you" | "opponent"; playerTurn: number; firstIndex: number; boardSummary?: string }[];
  playline: Playline;
  track?: OpponentTrack;
  onThePlay: boolean;
}

export function phaseIndex(phase: Phase | undefined): number {
  const i = phase ? PHASES.indexOf(phase) : -1;
  return i < 0 ? PHASES.indexOf("main1") : i;
}

/** Game turn for a player's Nth turn. */
export function gameTurnOf(playerTurn: number, actor: "you" | "opponent", onThePlay: boolean): number {
  const youFirst = onThePlay;
  const first = actor === "you" ? youFirst : !youFirst;
  return playerTurn * 2 - (first ? 1 : 0);
}

export function mergeTimeline(playline: Playline, track: OpponentTrack | undefined, opts: { onThePlay?: boolean } = {}): Timeline {
  const onThePlay = opts.onThePlay ?? true;
  type Raw = { step: TrajectoryStep; actor: "you" | "opponent"; sourceId: string; order: number };
  const raw: Raw[] = [];
  playline.steps.forEach((s, i) => raw.push({ step: s, actor: "you", sourceId: playline.id, order: i }));
  if (track) {
    let order = 0;
    for (const turn of track.turns) for (const e of turn.events) raw.push({ step: { ...e, turn: e.turn ?? turn.turn }, actor: "opponent", sourceId: track.id, order: order++ });
  }
  const keyed = raw.map((r) => {
    const playerTurn = r.step.turn ?? 1;
    const gameTurn = gameTurnOf(playerTurn, r.actor, onThePlay);
    // Within a game turn the active player acts first; a non-active player's steps in that turn
    // (e.g. an instant at your end step) sort after the active player's step in the same phase.
    const activePlayer: "you" | "opponent" = gameTurn % 2 === 1 ? (onThePlay ? "you" : "opponent") : onThePlay ? "opponent" : "you";
    const actorOrder = r.actor === activePlayer ? 0 : 1;
    return { r, gameTurn, activePlayer, key: [gameTurn, phaseIndex(r.step.phase), actorOrder, r.order] as const };
  });
  keyed.sort((a, b) => a.key[0] - b.key[0] || a.key[1] - b.key[1] || a.key[2] - b.key[2] || a.key[3] - b.key[3]);
  const steps: TimelineStep[] = keyed.map((k, index) => ({ ...k.r.step, actor: k.r.actor, index, gameTurn: k.gameTurn, activePlayer: k.activePlayer, sourceId: k.r.sourceId }));
  const turns: Timeline["turns"] = [];
  for (const s of steps) {
    if (turns[turns.length - 1]?.gameTurn !== s.gameTurn) {
      const playerTurn = Math.ceil(s.gameTurn / 2);
      const summary = s.activePlayer === "opponent" ? track?.turns.find((t) => t.turn === playerTurn)?.boardSummary : undefined;
      turns.push({ gameTurn: s.gameTurn, activePlayer: s.activePlayer, playerTurn, firstIndex: s.index, boardSummary: summary });
    }
  }
  return { steps, turns, playline, track, onThePlay };
}

/** Human labels: phases per CR 500.1; steps per CR 501.1 (beginning), 506.1 (combat), 512.1 (ending). */
export const PHASE_LABEL: Record<Phase, string> = {
  untap: "Untap",
  upkeep: "Upkeep",
  draw: "Draw",
  main1: "Main phase 1",
  "beginning-of-combat": "Beginning of combat",
  "declare-attackers": "Declare attackers",
  "declare-blockers": "Declare blockers",
  "combat-damage": "Combat damage",
  "end-of-combat": "End of combat",
  main2: "Main phase 2",
  end: "End step",
  cleanup: "Cleanup",
};

/** Pull `CR 603.6c`-style citations out of a note (also `CR Glossary: Dies`, `MTR 4.2`). */
export function citationsIn(text: string | undefined): { kind: "CR" | "MTR"; ref: string; label: string }[] {
  if (!text) return [];
  const out: { kind: "CR" | "MTR"; ref: string; label: string }[] = [];
  for (const m of text.matchAll(/\b(CR|MTR)\s+(\d{1,3}(?:\.\d+[a-z]?)?)/g)) {
    const kind = m[1] as "CR" | "MTR";
    const ref = m[2]!;
    if (!out.some((c) => c.kind === kind && c.ref === ref)) out.push({ kind, ref, label: `${kind} ${ref}` });
  }
  return out;
}
