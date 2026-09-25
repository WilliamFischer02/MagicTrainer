import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { importCollection, looksLikeCollectionCsv } from "../import/collectionImport";

const SAMPLES = resolve(__dirname, "../../../../data/samples/collections");
const read = (f: string) => readFileSync(resolve(SAMPLES, f), "utf8");

describe("importCollection", () => {
  it("reads the ManaBox sample with Scryfall ids and set codes", () => {
    const r = importCollection(read("manabox_sample.csv"), { fileName: "manabox_sample.csv" });
    expect(r.format).toBe("manabox-csv");
    expect(r.errors).toEqual([]);
    expect(r.entries.length).toBeGreaterThan(0);
    const sol = r.entries.find((e) => e.name === "Sol Ring")!;
    expect(sol.setCode).toBe("c21");
    expect(sol.collectorNumber).toBe("263");
    expect(sol.scryfallId).toMatch(/^[0-9a-f-]{36}$/);
    expect(r.totalCards).toBe(r.entries.reduce((n, e) => n + e.quantity, 0));
  });

  it("reads the TCGplayer sample using Simple Name and Printing", () => {
    const r = importCollection(read("tcgplayer_sample.csv"));
    expect(r.format).toBe("tcgplayer-csv");
    const cat = r.entries.find((e) => e.name === "Verdant Catacombs")!;
    expect(cat.foil).toBe(true);
    expect(cat.setCode).toBe("zen");
    const bolt = r.entries.find((e) => e.name === "Lightning Bolt")!;
    expect(bolt.quantity).toBe(4);
    expect(bolt.foil).toBe(false);
  });

  it("merges identical rows and reports it", () => {
    const csv = "Name,Set code,Set name,Collector number,Foil,Rarity,Quantity\nSol Ring,c21,Commander 2021,263,,uncommon,1\nSol Ring,c21,Commander 2021,263,,uncommon,2\nSol Ring,c21,Commander 2021,263,foil,uncommon,1\n";
    const r = importCollection(csv);
    expect(r.entries).toHaveLength(2);
    expect(r.entries.find((e) => !e.foil)?.quantity).toBe(3);
    expect(r.merged).toBe(1);
    expect(r.warnings.some((w) => w.includes("1 duplicate row was merged"))).toBe(true);
  });

  it("warns on unknown headers instead of throwing", () => {
    const r = importCollection("foo,bar\n1,2\n", { fileName: "x.csv" });
    expect(r.format).toBe("unknown");
    expect(r.entries).toEqual([]);
    expect(r.warnings[0]).toMatch(/does not look like/);
    expect(r.errors.some((e) => e.includes("Unrecognized headers"))).toBe(true);
  });

  it("guesses collection CSVs from the header line", () => {
    expect(looksLikeCollectionCsv("Name,Set code,Set name,Collector number,Quantity\n")).toBe(true);
    expect(looksLikeCollectionCsv("1 Sol Ring\n1 Swamp\n")).toBe(false);
    expect(looksLikeCollectionCsv("anything", "cards.csv")).toBe(true);
  });
});
