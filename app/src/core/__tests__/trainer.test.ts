import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { isPlaceholder, parseOpponentTrack, trackRealCardNames } from "../opponent/schema";
import { applyStep, deriveSnapshots, initialBoard } from "../trainer/boardState";
import { citationsIn, gameTurnOf, mergeTimeline, phaseIndex } from "../trainer/timeline";
import { buildPlayline, buildPlaylines, PATTERN_TO_TEMPLATE, TEMPLATES } from "../trajectory/templates";
import type { OpponentTrack, Playline, StrategyMatch } from "../types";

const TRACKS_DIR = join(__dirname, "../../../../opponent-tracks");

function loadTrack(file: string): OpponentTrack {
  const r = parseOpponentTrack(JSON.parse(readFileSync(join(TRACKS_DIR, file), "utf8")));
  expect(r.errors, file).toEqual([]);
  return r.track!;
}

describe("opponent track schema", () => {
  const files = readdirSync(TRACKS_DIR).filter((f) => f.endsWith(".track.json"));
  it("finds the shipped tracks", () => expect(files.length).toBeGreaterThanOrEqual(2));
  for (const f of files) {
    it(`${f} validates, has ≤ 12 turns, a teaches sentence, and a decision point`, () => {
      const r = parseOpponentTrack(JSON.parse(readFileSync(join(TRACKS_DIR, f), "utf8")));
      expect(r.errors).toEqual([]);
      expect(r.warnings.filter((w) => w.includes("decision"))).toEqual([]);
      expect(r.track!.turns.length).toBeLessThanOrEqual(12);
      for (const name of trackRealCardNames(r.track!)) expect(isPlaceholder(name)).toBe(false);
    });
  }
  it("rejects bad documents with readable errors", () => {
    const r = parseOpponentTrack({ schemaVersion: 2, id: "Bad Id", name: "", archetype: "x", description: "nothing", turns: [] });
    expect(r.track).toBeUndefined();
    expect(r.errors.join("\n")).toMatch(/schemaVersion/);
    expect(r.errors.join("\n")).toMatch(/kebab-case/);
    const r2 = parseOpponentTrack({
      schemaVersion: 1,
      id: "ok",
      name: "n",
      archetype: "a",
      description: "Teaches something.",
      turns: [
        { turn: 2, events: [{ step: 1, cardName: "X", from: "hand", to: "battlefield", action: "cast", turn: 2, phase: "main1" }] },
        { turn: 1, events: [{ step: 1, cardName: "Y", from: "hand", to: "battlefield", action: "cast", turn: 3, phase: "main1" }] },
      ],
    });
    expect(r2.errors.some((e) => e.includes("strictly increasing"))).toBe(true);
    expect(r2.errors.some((e) => e.includes("duplicate step"))).toBe(true);
    expect(r2.errors.some((e) => e.includes("sits in turn"))).toBe(true);
  });
});

const aristocrats: StrategyMatch = {
  patternId: "aristocrats",
  label: "Aristocrats (sacrifice engine)",
  confidence: 0.9,
  roles: { outlet: ["Viscera Seer"], payoff: ["Blood Artist"], fodder: ["Doomed Traveler"], recursion: ["Unearth"] },
  rationale: "test",
};

describe("timeline merge", () => {
  it("alternates game turns and puts the active player first", () => {
    const line = buildPlayline(aristocrats, "d")!;
    const track = loadTrack("mono-red-aggro.track.json");
    const tl = mergeTimeline(line, track, { onThePlay: true });
    expect(gameTurnOf(1, "you", true)).toBe(1);
    expect(gameTurnOf(1, "opponent", true)).toBe(2);
    expect(gameTurnOf(3, "you", true)).toBe(5);
    expect(gameTurnOf(1, "opponent", false)).toBe(1);
    // Non-decreasing game turn, then phase order within a turn.
    for (let i = 1; i < tl.steps.length; i++) {
      const a = tl.steps[i - 1]!;
      const b = tl.steps[i]!;
      expect(b.gameTurn).toBeGreaterThanOrEqual(a.gameTurn);
      if (a.gameTurn === b.gameTurn && a.actor === b.actor) expect(phaseIndex(b.phase)).toBeGreaterThanOrEqual(phaseIndex(a.phase));
    }
    expect(tl.steps.map((s) => s.index)).toEqual(tl.steps.map((_, i) => i));
    expect(tl.turns[0]).toMatchObject({ gameTurn: 2, activePlayer: "opponent", playerTurn: 1 });
    expect(tl.turns.find((t) => t.activePlayer === "opponent" && t.playerTurn === 3)?.boardSummary).toMatch(/burn in hand/);
    // Your turn-3 cast (game turn 5) comes before the opponent's turn-3 burn (game turn 6).
    const yourCast = tl.steps.find((s) => s.actor === "you" && s.action === "cast")!;
    const oppBurn = tl.steps.find((s) => s.actor === "opponent" && s.cardName === "[burn spell]")!;
    expect(yourCast.index).toBeLessThan(oppBurn.index);
  });

  it("works without a track and on the draw", () => {
    const line = buildPlayline(aristocrats, "d")!;
    const tl = mergeTimeline(line, undefined, { onThePlay: false });
    expect(tl.steps.every((s) => s.actor === "you")).toBe(true);
    expect(tl.steps[0]?.gameTurn).toBe(6); // your turn 3 on the draw
  });

  it("extracts CR / MTR citations from notes", () => {
    expect(citationsIn("Sacrifice is a cost (CR 603.2, 603.6c). See MTR 4.2.")).toEqual([
      { kind: "CR", ref: "603.2", label: "CR 603.2" },
      { kind: "MTR", ref: "4.2", label: "MTR 4.2" },
    ]);
    expect(citationsIn(undefined)).toEqual([]);
  });
});

describe("board state", () => {
  const line = buildPlayline(aristocrats, "d")!;
  const track = loadTrack("mono-red-aggro.track.json");
  const deck = { format: "commander" as const, commanders: [{ name: "Athreos, God of Passage", quantity: 1 }], main: [{ name: "Swamp", quantity: 99 }] };

  it("starts with commanders in the command zone, cast cards in hand, and 40 life in Commander", () => {
    const tl = mergeTimeline(line, track);
    const b0 = initialBoard(tl, deck);
    expect(b0.you.command.map((c) => c.name)).toEqual(["Athreos, God of Passage"]);
    expect(b0.you.hand.map((c) => c.name)).toEqual(expect.arrayContaining(["Blood Artist", "Viscera Seer", "Doomed Traveler", "Unearth"]));
    expect(b0.opponent.hand.some((c) => c.placeholder)).toBe(true);
    expect(b0.ledger.life).toEqual({ you: 40, opponent: 40 });
    expect(b0.you.library.length).toBe(92);
  });

  it("moves cards between zones, tracks life and hand size, and pulses triggers", () => {
    const tl = mergeTimeline(line, track);
    const snaps = deriveSnapshots(tl, deck, { cmcOf: (n) => ({ "blood artist": 2, "viscera seer": 1, "doomed traveler": 1, unearth: 1 })[n.toLowerCase()] });
    expect(snaps).toHaveLength(tl.steps.length + 1);
    const last = snaps[snaps.length - 1]!;
    // Blood Artist ended on the battlefield; Doomed Traveler was sacrificed twice (ends in graveyard).
    expect(last.you.battlefield.map((c) => c.name)).toEqual(expect.arrayContaining(["Blood Artist", "Viscera Seer"]));
    expect(last.you.graveyard.map((c) => c.name)).toContain("Doomed Traveler");
    // Opponent's aggro damage landed: 1 + 2 + 5 + 6 + 3 = 17; your drain triggers took 2.
    expect(last.ledger.life.you).toBe(40 - 17 + 2);
    expect(last.ledger.life.opponent).toBe(40 - 2);
    expect(last.ledger.cardsInHand.you).toBeLessThan(7);
    const trigger = snaps.find((s) => s.pulse?.key === "you:Blood Artist");
    expect(trigger?.pulse?.label).toMatch(/opponent loses 1 life/i);
    // Mana ledger resets each game turn and counts casts.
    const castIdx = tl.steps.findIndex((s) => s.cardName === "Blood Artist" && s.action === "cast");
    expect(snaps[castIdx + 1]!.ledger.manaSpentThisTurn).toBe(2);
    // Team attack marks every opponent creature as attacking.
    const teamIdx = tl.steps.findIndex((s) => s.cardName === "[team]");
    expect(snaps[teamIdx + 1]!.opponent.battlefield.every((c) => c.attacking)).toBe(true);
  });

  it("applyStep never throws for a card it has not seen", () => {
    const tl = mergeTimeline(line, undefined);
    const b0 = initialBoard(tl, undefined);
    const ghost = { ...tl.steps[0]!, cardName: "Never Mentioned", from: "graveyard" as const, to: "exile" as const, action: "exile" };
    const b1 = applyStep(b0, ghost);
    expect(b1.you.exile.map((c) => c.name)).toEqual(["Never Mentioned"]);
  });
});

describe("playline templates", () => {
  it("every pattern with a playline id has a template", () => {
    for (const key of Object.values(PATTERN_TO_TEMPLATE)) expect(TEMPLATES[key], key).toBeTruthy();
  });

  const matches: StrategyMatch[] = [
    aristocrats,
    { patternId: "lifegain-drain-loop", label: "Drain", confidence: 1, roles: { "gain-to-drain": ["Sanguine Bond"], "drain-to-gain": ["Exquisite Blood"], starter: ["Soul Warden"] }, rationale: "t" },
    { patternId: "reanimator", label: "Reanimator", confidence: 0.8, roles: { reanimate: ["Animate Dead"], enabler: ["Faithless Looting"], target: ["Griselbrand"] }, rationale: "t" },
    { patternId: "power-ramp-stompy", label: "Stompy", confidence: 0.8, roles: { ramp: ["Llanowar Elves", "Rampant Growth"], threat: ["Ghalta, Primal Hunger", "Craterhoof Behemoth"], overrun: ["Overrun"] }, rationale: "t" },
    { patternId: "prowess-tempo", label: "Prowess", confidence: 0.8, roles: { prowess: ["Monastery Swiftspear"], spells: ["Lightning Bolt", "Mutagenic Growth", "Lava Spike"], burn: ["Lava Spike"] }, rationale: "t" },
    { patternId: "artifact-aggro", label: "Affinity", confidence: 0.8, roles: { "cheap-artifacts": ["Ornithopter", "Memnite", "Springleaf Drum"], payoff: ["Cranial Plating"] }, rationale: "t" },
    { patternId: "creature-aggro", label: "Aggro", confidence: 0.8, roles: { "cheap-threats": ["Goblin Guide", "Monastery Swiftspear", "Eidolon of the Great Revel"], tricks: ["Brute Strength"], reach: ["Lightning Bolt"] }, rationale: "t" },
    { patternId: "stompy", label: "Stompy", confidence: 0.8, roles: { beaters: ["Pelt Collector", "Steel Leaf Champion"], pump: ["Vines of Vastwood", "Aspect of Hydra"], protection: ["Blossoming Defense"] }, rationale: "t" },
  ];

  it("builds a numbered, turn-stamped playline for each of the eight templates", () => {
    const lines: Playline[] = buildPlaylines(matches, "deck");
    expect(lines).toHaveLength(8);
    for (const p of lines) {
      expect(p.steps.map((s) => s.step)).toEqual(p.steps.map((_, i) => i + 1));
      for (const s of p.steps) {
        expect(s.turn).toBeGreaterThan(0);
        expect(s.phase).toBeTruthy();
      }
      expect(p.steps.some((s) => s.breakPoint)).toBe(true);
      expect(p.outcome).toBeTruthy();
    }
  });

  it("derives damage from printed power and casts commanders from the command zone", () => {
    const power: Record<string, number> = { "Monastery Swiftspear": 1, "Goblin Guide": 2, "Eidolon of the Great Revel": 2, "Griselbrand": 7 };
    const opts = { powerOf: (n: string) => power[n], hasKeyword: (n: string, k: string) => n === "Monastery Swiftspear" && k === "Haste", isCommander: (n: string) => n === "Blood Artist" };
    const prowess = buildPlayline(matches[4]!, "d", opts)!;
    expect(prowess.steps[1]).toMatchObject({ action: "attack", turn: 1, damage: 1 }); // haste attack on turn 1
    const rean = buildPlayline(matches[2]!, "d", opts)!;
    expect(rean.steps.find((s) => s.action === "attack")?.damage).toBe(7);
    const aris = buildPlayline(aristocrats, "d", opts)!;
    expect(aris.steps[0]).toMatchObject({ cardName: "Blood Artist", from: "command" });
    const noPower = buildPlayline(matches[2]!, "d", {})!;
    expect(noPower.steps.find((s) => s.action === "attack")?.damage).toBeUndefined();
  });

  it("returns null when a required role is empty", () => {
    expect(buildPlayline({ ...aristocrats, roles: { outlet: ["Viscera Seer"] } }, "d")).toBeNull();
    expect(buildPlayline({ patternId: "unknown", label: "x", confidence: 1, roles: {}, rationale: "" }, "d")).toBeNull();
  });
});
