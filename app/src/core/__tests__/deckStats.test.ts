import { describe, expect, it } from "vitest";
import { analyzeDeck, colorBalance, isLand, legalityIssues, manaCurve, pipsOf, primaryType, roleCoverage, type CountedCard } from "../math/deckStats";
import type { CardOracle } from "../types";

/** Stub cards — paraphrased/minimal, NOT real Oracle text (labelled per CLAUDE.md). */
function stub(over: Partial<CardOracle> & { name: string }): CardOracle {
  return {
    oracleId: `o-${over.name.toLowerCase().replace(/\W+/g, "-")}`,
    cmc: 0,
    typeLine: "Creature — Test",
    colors: [],
    colorIdentity: [],
    keywords: [],
    legalities: { commander: "legal", modern: "legal" },
    oracleTags: [],
    layout: "normal",
    ...over,
  };
}

const swamp = stub({ name: "Swamp", typeLine: "Basic Land — Swamp", producedMana: ["B"] });
const plains = stub({ name: "Plains", typeLine: "Basic Land — Plains", producedMana: ["W"] });
const godless = stub({ name: "Godless Shrine", typeLine: "Land — Plains Swamp", producedMana: ["W", "B"] });
const signet = stub({ name: "Orzhov Signet", typeLine: "Artifact", cmc: 2, manaCost: "{2}", producedMana: ["W", "B"], oracleTags: ["mana-rock", "mana-producer", "ramp"] });
const artist = stub({ name: "Blood Artist", typeLine: "Creature — Vampire", cmc: 2, manaCost: "{1}{B}", colors: ["B"], oracleTags: ["death-trigger"] });
const priest = stub({ name: "Banisher Priest", typeLine: "Creature — Human Cleric", cmc: 3, manaCost: "{1}{W}{W}", colors: ["W"], oracleTags: ["removal", "spot-removal"] });
const hybrid = stub({ name: "Hybrid Test", typeLine: "Sorcery", cmc: 2, manaCost: "{W/B}{W/B}", oracleTags: ["draw", "pure-draw"] });
const big = stub({ name: "Big Thing", typeLine: "Creature — Elemental", cmc: 9, manaCost: "{7}{B}{B}", legalities: { commander: "banned", modern: "not_legal" } });
const wipe = stub({ name: "Wipe Test", typeLine: "Sorcery", cmc: 4, manaCost: "{2}{W}{W}", oracleTags: ["sweeper", "removal"] });
const mdfc = stub({ name: "Spell // Landside", typeLine: "Instant // Land", cmc: 2, manaCost: "{1}{W}", producedMana: ["W"], layout: "modal_dfc" });
const athreos = stub({ name: "Athreos, God of Passage", typeLine: "Legendary Enchantment Creature — God", cmc: 3, manaCost: "{1}{W}{B}", colors: ["W", "B"], colorIdentity: ["W", "B"] });

function counted(list: [CardOracle, number][], section: CountedCard["section"] = "main"): CountedCard[] {
  return list.map(([card, quantity]) => ({ card, quantity, section }));
}

describe("pips and lands", () => {
  it("counts colored pips, hybrid for both, ignores generic", () => {
    expect(pipsOf("{1}{W}{W}{W/U}{G/P}")).toEqual({ W: 3, U: 1, B: 0, R: 0, G: 1 });
    expect(pipsOf(undefined)).toEqual({ W: 0, U: 0, B: 0, R: 0, G: 0 });
  });
  it("treats front-face lands as lands but not spell // land MDFCs", () => {
    expect(isLand(godless)).toBe(true);
    expect(isLand(mdfc)).toBe(false);
    expect(primaryType(athreos)).toBe("Creature");
    expect(primaryType(godless)).toBe("Land");
  });
});

describe("mana curve", () => {
  it("buckets nonlands by mana value with a 7+ tail and computes averages", () => {
    const c = manaCurve(counted([[swamp, 10], [artist, 2], [priest, 1], [big, 1], [signet, 1]]));
    expect(c.landCount).toBe(10);
    expect(c.nonlandCount).toBe(5);
    expect(c.buckets.map((b) => b.count)).toEqual([0, 0, 3, 1, 0, 0, 0, 1]);
    expect(c.buckets[2]?.creatures).toBe(2);
    expect(c.buckets[7]?.label).toBe("7+");
    expect(c.averageMv).toBe((2 * 3 + 3 + 9) / 5);
    expect(c.medianMv).toBe(2);
    expect(c.maxBucket).toBe(3);
  });
});

describe("color balance", () => {
  it("compares pips to land and nonland sources per color", () => {
    const cb = colorBalance(counted([[swamp, 5], [plains, 3], [godless, 1], [signet, 1], [artist, 1], [priest, 1], [hybrid, 1]]));
    const w = cb.find((x) => x.color === "W")!;
    const b = cb.find((x) => x.color === "B")!;
    expect(w.pips).toBe(2 + 2); // priest WW + hybrid counts W twice
    expect(b.pips).toBe(1 + 2);
    expect(w.landSources).toBe(4); // 3 plains + shrine
    expect(b.landSources).toBe(6);
    expect(w.otherSources).toBe(1); // signet
    expect(w.pipShare + b.pipShare).toBeCloseTo(1);
    expect(cb.find((x) => x.color === "G")!.pips).toBe(0);
  });
});

describe("role coverage", () => {
  it("counts tagged nonland cards and grades against the Commander skeleton", () => {
    const roles = roleCoverage(counted([[swamp, 30], [signet, 9], [hybrid, 3], [priest, 10], [wipe, 2]]), "commander");
    const byId = Object.fromEntries(roles.map((r) => [r.id, r]));
    expect(byId.lands).toMatchObject({ count: 30, status: "low" });
    expect(byId.ramp).toMatchObject({ count: 9, status: "ok" });
    expect(byId.draw).toMatchObject({ count: 3, status: "low" });
    expect(byId.removal).toMatchObject({ count: 12, status: "ok" }); // 10 priests + 2 wipes
    expect(byId.sweeper).toMatchObject({ count: 2, status: "ok" });
    expect(byId.tutor).toMatchObject({ count: 0, status: "info" });
    expect(byId.ramp?.cards).toEqual(["Orzhov Signet"]);
  });
  it("uses a lower land floor for low curves and no targets outside Commander", () => {
    const low = roleCoverage(counted([[swamp, 34], [artist, 30]]), "commander");
    expect(low.find((r) => r.id === "lands")).toMatchObject({ count: 34, status: "ok" });
    const modern = roleCoverage(counted([[swamp, 20]]), "modern");
    expect(modern.every((r) => r.status === "info")).toBe(true);
  });
});

describe("legality", () => {
  it("lists banned / not legal cards for the format, nothing for casual", () => {
    const cards = counted([[big, 1], [artist, 1]]);
    expect(legalityIssues(cards, "commander")).toEqual([{ name: "Big Thing", quantity: 1, status: "banned" }]);
    expect(legalityIssues(cards, "modern")).toEqual([{ name: "Big Thing", quantity: 1, status: "not_legal" }]);
    expect(legalityIssues(cards, "casual")).toEqual([]);
    expect(legalityIssues(cards, undefined)).toEqual([]);
  });
  it("allows a single copy of a restricted card", () => {
    const r = stub({ name: "Restricted Test", legalities: { vintage: "restricted" } });
    expect(legalityIssues(counted([[r, 1]]), "vintage")).toEqual([]);
    expect(legalityIssues(counted([[r, 2]]), "vintage")).toEqual([{ name: "Restricted Test", quantity: 2, status: "restricted" }]);
  });
});

describe("analyzeDeck", () => {
  it("joins entries to cards, reports missing ones, and derives deck colors from commander identity", () => {
    const cards = new Map([athreos, swamp, artist].map((c) => [c.oracleId, c] as const));
    const a = analyzeDeck(
      {
        format: "commander",
        commanders: [{ name: athreos.name, quantity: 1, oracleId: athreos.oracleId }],
        main: [
          { name: swamp.name, quantity: 36, oracleId: swamp.oracleId },
          { name: artist.name, quantity: 1, oracleId: artist.oracleId },
          { name: "Unknown Card", quantity: 1 },
        ],
      },
      cards,
    );
    expect(a.missing.map((m) => m.name)).toEqual(["Unknown Card"]);
    expect(a.deckColors).toEqual(["W", "B"]);
    expect(a.totalCards).toBe(39);
    expect(a.curve.landCount).toBe(36);
    expect(a.types.find((t) => t.type === "Creature")?.count).toBe(2);
  });
});
