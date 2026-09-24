import { describe, it, expect } from "vitest";
import golden from "../resolve/normalize.golden.json";
import { looseCardKey, normalizeCardName, splitFaceNames } from "../resolve/normalize";
import { NameIndex, levenshtein, similarity } from "../resolve/resolver";

describe("normalizeCardName / looseCardKey (golden, shared with cargo test)", () => {
  for (const c of golden.cases) {
    it(JSON.stringify(c.input), () => {
      expect(normalizeCardName(c.input)).toBe(c.norm);
      expect(looseCardKey(c.input)).toBe(c.loose);
    });
  }
  it("splits faces", () => {
    expect(splitFaceNames("Fire // Ice")).toEqual(["Fire", "Ice"]);
    expect(splitFaceNames("Sol Ring")).toEqual(["Sol Ring"]);
  });
});

describe("levenshtein / similarity", () => {
  it("basic distances", () => {
    expect(levenshtein("", "")).toBe(0);
    expect(levenshtein("abc", "")).toBe(3);
    expect(levenshtein("kitten", "sitting")).toBe(3);
    expect(similarity("sol ring", "sol ring")).toBe(1);
    expect(similarity("sol ring", "sol rng")).toBeCloseTo(1 - 1 / 8);
  });
});

/** STUB index: names are real Scryfall names, oracle ids are fake. */
const STUB = [
  { oracleId: "o-solring", name: "Sol Ring", layout: "normal" },
  { oracleId: "o-athreos", name: "Athreos, God of Passage", layout: "normal" },
  { oracleId: "o-limdul", name: "Lim-Dûl's Vault", layout: "normal" },
  { oracleId: "o-fireice", name: "Fire // Ice", layout: "split" },
  { oracleId: "o-ulvenwald", name: "Ulvenwald Captive // Ulvenwald Abomination", layout: "transform" },
  { oracleId: "o-gollum", name: "Gollum, Silent Slinker // Meager Meal", layout: "adventure" },
  { oracleId: "o-treasure-token", name: "Treasure", layout: "token" },
  { oracleId: "o-bloodartist", name: "Blood Artist", layout: "normal" },
  { oracleId: "o-bloodbaron", name: "Blood Baron of Vizkopa", layout: "normal" },
  { oracleId: "o-exquisite", name: "Exquisite Blood", layout: "normal" },
];

describe("NameIndex.resolve", () => {
  const index = new NameIndex(STUB);

  it("excludes non-playable layouts", () => {
    expect(index.size).toBe(STUB.length - 1);
    const r = index.resolve("Treasure");
    expect(r.oracleId).toBeUndefined();
    expect(r.confidence).toBe(0);
  });

  it("exact (case/space-insensitive)", () => {
    const r = index.resolve("  sol RING ");
    expect(r).toMatchObject({ oracleId: "o-solring", name: "Sol Ring", method: "exact", confidence: 1 });
    expect(r.candidates).toEqual([]);
  });

  it("diacritics and curly apostrophes", () => {
    expect(index.resolve("Lim-Dul's Vault").method).toBe("exact");
    expect(index.resolve("Lim-Dûl’s Vault").method).toBe("exact");
  });

  it("split / DFC / adventure faces", () => {
    expect(index.resolve("Fire")).toMatchObject({ oracleId: "o-fireice", method: "face", confidence: 0.99 });
    expect(index.resolve("Ice")).toMatchObject({ oracleId: "o-fireice", method: "face" });
    expect(index.resolve("Ulvenwald Captive")).toMatchObject({ oracleId: "o-ulvenwald", method: "face" });
    expect(index.resolve("Ulvenwald Abomination")).toMatchObject({ oracleId: "o-ulvenwald", method: "face" });
    expect(index.resolve("Gollum, Silent Slinker")).toMatchObject({ oracleId: "o-gollum", method: "face" });
    expect(index.resolve("Fire//Ice")).toMatchObject({ oracleId: "o-fireice", method: "exact" });
  });

  it("punctuation-insensitive", () => {
    expect(index.resolve("Athreos God of Passage")).toMatchObject({ oracleId: "o-athreos", method: "normalized", confidence: 0.97 });
    expect(index.resolve("lim duls vault")).toMatchObject({ oracleId: "o-limdul", method: "normalized" });
    expect(index.resolve("ulvenwald captive")).toMatchObject({ oracleId: "o-ulvenwald" });
  });

  it("fuzzy typo within threshold", () => {
    const r = index.resolve("Athreos, God of Pasage");
    expect(r.oracleId).toBe("o-athreos");
    expect(r.method).toBe("fuzzy");
    expect(r.confidence).toBeGreaterThanOrEqual(0.85);
    expect(r.candidates[0]?.oracleId).toBe("o-athreos");
  });

  it("fuzzy on a DFC face with a typo", () => {
    const r = index.resolve("Ulvenwald Captve");
    expect(r.oracleId).toBe("o-ulvenwald");
    expect(r.method).toBe("fuzzy");
  });

  it("unresolved returns ranked candidates, never a guess", () => {
    const r = index.resolve("Blood");
    expect(r.oracleId).toBeUndefined();
    expect(r.confidence).toBe(0);
    expect(r.candidates.length).toBeGreaterThan(0);
    expect(r.candidates.map((c) => c.oracleId)).toContain("o-bloodartist");
  });

  it("empty input", () => {
    expect(index.resolve("   ")).toEqual({ input: "   ", confidence: 0, candidates: [] });
  });

  it("resolveMany keeps order", () => {
    const rs = index.resolveMany(["Sol Ring", "nope nope nope", "Fire"]);
    expect(rs.map((r) => r.oracleId)).toEqual(["o-solring", undefined, "o-fireice"]);
  });
});
