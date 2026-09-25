import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import {
  FindMyCombosResultsSchema,
  includedCombos,
  missingCards,
  nearMissCombos,
  spellbookComboUrl,
  variantConfidence,
  variantLabel,
  variantToStrategyMatch,
} from "../strategy/spellbook";

/** Real `find-my-combos` answer captured 2026-09-24 for [Exquisite Blood, Sanguine Bond, 30 Swamp]. */
const FIXTURE = resolve(__dirname, "../../../../knowledge/mtg-data-apis/commander-spellbook/sample_find-my-combos_exquisite-blood.json");
const DECK = ["Exquisite Blood", "Sanguine Bond", "Swamp"];

function loadResults() {
  const doc = JSON.parse(readFileSync(FIXTURE, "utf8")) as { results: unknown };
  return FindMyCombosResultsSchema.parse(doc.results);
}

describe("Spellbook find-my-combos schema", () => {
  it("parses the live sample", () => {
    const r = loadResults();
    expect(r.identity).toBe("B");
    expect(r.included).toHaveLength(1);
    expect(r.included[0]?.id).toBe("690-3966");
    expect(r.almostIncluded).toHaveLength(10);
    expect(r.almostIncludedByAddingColors).toHaveLength(7);
  });

  it("tolerates missing optional fields", () => {
    const r = FindMyCombosResultsSchema.parse({ included: [{ id: "1-2", uses: [{ card: { name: "A" } }] }] });
    expect(r.included[0]?.uses[0]?.quantity).toBe(1);
    expect(r.almostIncluded).toEqual([]);
  });
});

describe("variant → StrategyMatch", () => {
  it("names the variant id, pieces and products in the rationale (D-008)", () => {
    const v = loadResults().included[0]!;
    const m = variantToStrategyMatch(v);
    expect(m.patternId).toBe("spellbook:690-3966");
    expect(m.label).toBe("Sanguine Bond + Exquisite Blood");
    expect(m.roles.pieces).toEqual(["Sanguine Bond", "Exquisite Blood"]);
    expect(m.rationale).toContain("Commander Spellbook variant 690-3966");
    expect(m.rationale).toContain("uses Sanguine Bond, Exquisite Blood");
    expect(m.rationale).toContain("Infinite lifeloss");
    expect(m.externalRef).toEqual({ source: "commander-spellbook", id: "690-3966", url: "https://commanderspellbook.com/combo/690-3966/" });
    expect(m.confidence).toBe(0.95);
  });

  it("scores more pieces / templates lower", () => {
    const two = { id: "x", uses: [{ card: { name: "A" } }, { card: { name: "B" } }], requires: [] };
    const four = { id: "y", uses: [{ card: { name: "A" } }, { card: { name: "B" } }, { card: { name: "C" } }, { card: { name: "D" } }], requires: [] };
    const withTemplate = { id: "z", uses: [{ card: { name: "A" } }], requires: [{ template: { name: "a sacrifice outlet" } }] };
    const parse = (v: unknown) => FindMyCombosResultsSchema.parse({ included: [v] }).included[0]!;
    expect(variantConfidence(parse(two))).toBe(0.95);
    expect(variantConfidence(parse(four))).toBe(0.8);
    expect(variantConfidence(parse(withTemplate))).toBe(0.9);
    expect(variantLabel(parse(withTemplate))).toBe("A + (a sacrifice outlet)");
    expect(spellbookComboUrl("690-3966")).toBe("https://commanderspellbook.com/combo/690-3966/");
  });

  it("orders confirmed combos by popularity", () => {
    const r = FindMyCombosResultsSchema.parse({
      included: [
        { id: "a", popularity: 5, uses: [{ card: { name: "A" } }] },
        { id: "b", popularity: 50, uses: [{ card: { name: "B" } }] },
      ],
    });
    expect(includedCombos(r).map((m) => m.externalRef?.id)).toEqual(["b", "a"]);
  });
});

describe("near-miss combos", () => {
  it("computes the missing cards against the deck and sorts closest first", () => {
    const r = loadResults();
    const near = nearMissCombos(r, DECK);
    expect(near.length).toBeGreaterThan(0);
    for (const n of near) {
      expect(n.missing.length).toBeGreaterThan(0);
      for (const name of n.missing) expect(DECK).not.toContain(name);
      expect(n.match.rationale).toContain(`missing ${n.missing.join(", ")}`);
    }
    const counts = near.map((n) => n.missing.length);
    expect([...counts].sort((a, b) => a - b)).toEqual(counts);
    const vito = near.find((n) => n.variant.id === "314-3966");
    expect(vito?.missing).toEqual(["Vito, Thorn of the Dusk Rose"]);
    expect(vito?.reason).toBe("almost");
  });

  it("matches split/DFC names by front face and ignores case", () => {
    const v = FindMyCombosResultsSchema.parse({ included: [{ id: "s", uses: [{ card: { name: "Fire // Ice" } }, { card: { name: "Sol Ring" } }] }] }).included[0]!;
    expect(missingCards(v, ["fire", "SOL RING"])).toEqual([]);
    expect(missingCards(v, ["Sol Ring"])).toEqual(["Fire // Ice"]);
  });

  it("drops a variant the deck already completes and respects the limit", () => {
    const r = FindMyCombosResultsSchema.parse({
      almostIncluded: [
        { id: "done", uses: [{ card: { name: "A" } }] },
        { id: "one", popularity: 1, uses: [{ card: { name: "A" } }, { card: { name: "B" } }] },
        { id: "two", popularity: 9, uses: [{ card: { name: "A" } }, { card: { name: "C" } }] },
      ],
      almostIncludedByAddingColors: [{ id: "one", uses: [{ card: { name: "A" } }, { card: { name: "B" } }] }],
    });
    const near = nearMissCombos(r, ["A"]);
    expect(near.map((n) => n.variant.id)).toEqual(["two", "one"]);
    expect(nearMissCombos(r, ["A"], 1)).toHaveLength(1);
  });
});
