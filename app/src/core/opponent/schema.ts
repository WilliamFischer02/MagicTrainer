import { z } from "zod";
import type { OpponentTrack, Phase, Zone } from "../types";

/**
 * Opponent track schema (`docs/OPPONENT_TRACKS.md`, schemaVersion 1). Tracks are static timelines,
 * never a rules engine (D-007). Bracketed card names like `[burn spell]` are role placeholders.
 */

export const ZONES: readonly Zone[] = ["library", "hand", "stack", "battlefield", "graveyard", "exile", "command"];
export const PHASES: readonly Phase[] = [
  "untap",
  "upkeep",
  "draw",
  "main1",
  "beginning-of-combat",
  "declare-attackers",
  "declare-blockers",
  "combat-damage",
  "end-of-combat",
  "main2",
  "end",
  "cleanup",
];

const ZoneSchema = z.enum(ZONES as [Zone, ...Zone[]]);
const PhaseSchema = z.enum(PHASES as [Phase, ...Phase[]]);

export const TrackStepSchema = z.object({
  step: z.number().int().positive(),
  actor: z.literal("opponent").default("opponent"),
  cardName: z.string().min(1),
  from: ZoneSchema,
  to: ZoneSchema,
  action: z.string().min(1),
  note: z.string().optional(),
  causedBy: z.array(z.string()).optional(),
  turn: z.number().int().positive(),
  phase: PhaseSchema,
  damage: z.number().nonnegative().optional(),
  lifeChange: z.object({ you: z.number().optional(), opponent: z.number().optional() }).optional(),
  manaSpent: z.number().nonnegative().optional(),
  breakPoint: z.string().optional(),
});

export const OpponentTurnSchema = z.object({
  turn: z.number().int().positive(),
  boardSummary: z.string().optional(),
  events: z.array(TrackStepSchema),
});

export const OpponentTrackSchema = z
  .object({
    schemaVersion: z.literal(1),
    id: z.string().regex(/^[a-z0-9-]+$/, "id must be kebab-case"),
    name: z.string().min(1),
    archetype: z.string().min(1),
    description: z.string().min(1),
    turns: z.array(OpponentTurnSchema).min(1).max(12),
  })
  .superRefine((t, ctx) => {
    let last = 0;
    const seen = new Set<number>();
    for (const turn of t.turns) {
      if (turn.turn <= last) ctx.addIssue({ code: "custom", message: `turns must be strictly increasing (turn ${turn.turn} after ${last})`, path: ["turns"] });
      last = turn.turn;
      for (const e of turn.events) {
        if (e.turn !== turn.turn) ctx.addIssue({ code: "custom", message: `event step ${e.step} says turn ${e.turn} but sits in turn ${turn.turn}`, path: ["turns"] });
        if (seen.has(e.step)) ctx.addIssue({ code: "custom", message: `duplicate step number ${e.step}`, path: ["turns"] });
        seen.add(e.step);
      }
    }
    if (!/teach/i.test(t.description)) ctx.addIssue({ code: "custom", message: "description must say what the track teaches", path: ["description"] });
  });

export type ParsedTrack = z.infer<typeof OpponentTrackSchema>;

export interface TrackParseResult {
  track?: OpponentTrack;
  errors: string[];
  warnings: string[];
}

/** Placeholder card names are wrapped in brackets: `[burn spell]`. */
export function isPlaceholder(cardName: string): boolean {
  return /^\[.+\]$/.test(cardName.trim());
}

/** Parse + validate a track document. Never throws; returns errors as strings for the UI / tests. */
export function parseOpponentTrack(json: unknown): TrackParseResult {
  const r = OpponentTrackSchema.safeParse(json);
  if (!r.success) {
    return { errors: r.error.issues.map((i) => `${i.path.join(".") || "(root)"}: ${i.message}`), warnings: [] };
  }
  const t = r.data;
  const warnings: string[] = [];
  const hasDecisionNote = t.turns.some((turn) => turn.events.some((e) => (e.note && /decision/i.test(e.note)) || e.breakPoint));
  if (!hasDecisionNote) warnings.push("no decision-point note or break point; the step panel will have nothing to teach");
  for (const turn of t.turns) if (!turn.boardSummary) warnings.push(`turn ${turn.turn} has no boardSummary`);
  const track: OpponentTrack = {
    id: t.id,
    name: t.name,
    archetype: t.archetype,
    description: t.description,
    turns: t.turns.map((turn) => ({
      turn: turn.turn,
      boardSummary: turn.boardSummary,
      events: turn.events.map((e) => ({ ...e, actor: "opponent" as const })),
    })),
  };
  return { track, errors: [], warnings };
}

/** Real (non-placeholder) card names a track references — verify these against Scryfall. */
export function trackRealCardNames(track: OpponentTrack): string[] {
  const names = new Set<string>();
  for (const turn of track.turns) for (const e of turn.events) if (!isPlaceholder(e.cardName)) names.add(e.cardName);
  return [...names].sort();
}
