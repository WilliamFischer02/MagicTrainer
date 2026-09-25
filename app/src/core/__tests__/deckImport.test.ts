import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { deckNameFromComment, deckNameFromFileName, deckWarnings, formatFromComment, importDeck, inferFormat } from "../import/deckImport";

const SAMPLES = resolve(__dirname, "../../../../data/samples");
const read = (rel: string) => readFileSync(resolve(SAMPLES, rel), "utf8");

describe("deck names and formats from files", () => {
  it("derives a title from the file name", () => {
    expect(deckNameFromFileName("athreos-aristocrats.txt")).toBe("Athreos Aristocrats");
    expect(deckNameFromFileName("C:\\decks\\mono_blue_affinity.dec")).toBe("Mono Blue Affinity");
    expect(deckNameFromFileName("My Deck (1).csv")).toBe("My Deck (1)");
    expect(deckNameFromFileName(".txt")).toBe("Untitled deck");
  });

  it("prefers a quoted name in a leading comment and reads the format comment", () => {
    const raw = read("decks/athreos-aristocrats.txt");
    expect(deckNameFromComment(raw)).toBe("Athreos");
    expect(formatFromComment(raw)).toBe("commander");
    expect(formatFromComment("1 Sol Ring")).toBeUndefined();
    expect(formatFromComment("# format: Modern\n4 Ragavan")).toBe("modern");
  });

  it("infers commander from a commander section or 100 cards", () => {
    expect(inferFormat({ commanders: [{ name: "X", quantity: 1 }], main: [], sideboard: [] })).toBe("commander");
    expect(inferFormat({ commanders: [], main: [{ name: "Swamp", quantity: 99 }], sideboard: [] })).toBe("commander");
    expect(inferFormat({ commanders: [], main: [{ name: "Swamp", quantity: 60 }], sideboard: [] })).toBeUndefined();
  });
});

describe("importDeck", () => {
  it("imports William's Athreos list as a 100-card Commander deck with no warnings", () => {
    const { deck, warnings, errors } = importDeck(read("decks/athreos-aristocrats.txt"), { fileName: "athreos-aristocrats.txt" });
    expect(deck.name).toBe("Athreos");
    expect(deck.format).toBe("commander");
    expect(deck.commanders.map((c) => c.name)).toEqual(["Athreos, God of Passage"]);
    expect(deck.main.reduce((n, e) => n + e.quantity, 0)).toBe(99);
    expect(deck.source.format).toBe("decklist-text");
    expect(errors).toEqual([]);
    expect(warnings).toEqual([]);
  });

  it("flags a Commander list that is not 100 cards or breaks singleton", () => {
    const { deck, warnings } = importDeck("Commander\n1 Athreos, God of Passage\n\nDeck\n2 Blood Artist\n30 Swamp");
    expect(deck.format).toBe("commander");
    expect(warnings.some((w) => w.includes("exactly 100 cards"))).toBe(true);
    expect(warnings.some((w) => w.includes("Singleton") && w.includes("2× Blood Artist"))).toBe(true);
  });

  it("checks 60-card constructed rules when a format is set", () => {
    const { deck } = importDeck("# format: modern\n5 Lightning Bolt\n20 Mountain\nSideboard\n16 Pyroblast");
    const w = deckWarnings(deck);
    expect(w.some((x) => x.includes("at least 60"))).toBe(true);
    expect(w.some((x) => x.includes("Sideboards are capped"))).toBe(true);
    expect(w.some((x) => x.includes("More than four") && x.includes("5× Lightning Bolt"))).toBe(true);
  });

  it("reads a ManaBox CSV into the main deck", () => {
    const { deck, errors } = importDeck(read("collections/manabox_sample.csv"), { fileName: "manabox_sample.csv" });
    expect(deck.source.format).toBe("manabox-csv");
    expect(deck.name).toBe("Manabox Sample");
    expect(deck.main.length).toBeGreaterThan(0);
    expect(errors).toEqual([]);
    for (const e of deck.main) expect(e.quantity).toBeGreaterThan(0);
  });

  it("warns instead of failing on empty or unrecognized text", () => {
    const { deck, warnings } = importDeck("just some prose\nwithout numbers");
    expect(deck.main).toEqual([]);
    expect(warnings[0]).toMatch(/No cards were recognized/);
  });

  it("keeps extra sections and mentions them", () => {
    const { deck, warnings } = importDeck("Deck\n60 Island\nMaybeboard\n1 Counterspell");
    expect(deck.extra.maybeboard?.[0]?.name).toBe("Counterspell");
    expect(warnings.some((w) => w.includes("maybeboard"))).toBe(true);
  });
});
