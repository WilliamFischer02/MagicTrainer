import { describe, it, expect } from "vitest";
import { parseDecklist, countCards, parseDeckLine } from "../parsers/decklist";
import { parseCollectionCsv, detectCollectionFormat } from "../parsers/collection";

describe("parseDeckLine", () => {
  it("parses plain lines", () => {
    expect(parseDeckLine("1 Sol Ring")?.entry).toMatchObject({ name: "Sol Ring", quantity: 1 });
    expect(parseDeckLine("4x Lightning Bolt")?.entry).toMatchObject({ name: "Lightning Bolt", quantity: 4 });
  });
  it("parses Arena export lines with set + collector number", () => {
    expect(parseDeckLine("1 Sol Ring (C21) 263")?.entry).toMatchObject({ name: "Sol Ring", setCode: "c21", collectorNumber: "263" });
  });
  it("parses MTGO SB: prefix", () => {
    expect(parseDeckLine("SB: 2 Negate")).toMatchObject({ section: "sideboard", entry: { name: "Negate", quantity: 2 } });
  });
  it("ignores comments and blanks", () => {
    expect(parseDeckLine("// my deck")).toBeNull();
    expect(parseDeckLine("   ")).toBeNull();
  });
  it("keeps commas and apostrophes in names", () => {
    expect(parseDeckLine("1 Athreos, God of Passage")?.entry?.name).toBe("Athreos, God of Passage");
    expect(parseDeckLine("1 Garruk's Uprising")?.entry?.name).toBe("Garruk's Uprising");
  });
});

describe("parseDecklist", () => {
  it("handles sections and counts", () => {
    const deck = parseDecklist(`Commander\n1 Athreos, God of Passage\n\nDeck\n1 Sol Ring\n12 Plains\n12 Swamp\n\nSideboard\n1 Rest in Peace`);
    expect(deck.commanders).toHaveLength(1);
    expect(countCards(deck.main)).toBe(25);
    expect(deck.sideboard[0].name).toBe("Rest in Peace");
    expect(deck.source.format).toBe("decklist-text");
  });
  it("merges duplicate lines", () => {
    const deck = parseDecklist("2 Shock\n2 Shock");
    expect(deck.main).toHaveLength(1);
    expect(deck.main[0].quantity).toBe(4);
  });
  it("detects Arena dialect", () => {
    expect(parseDecklist("Deck\n4 Shock (M20) 160").source.format).toBe("arena-text");
  });
});

describe("collection CSV", () => {
  it("detects ManaBox headers", () => {
    expect(detectCollectionFormat(["Name", "Set code", "Set name", "Collector number", "Foil", "Rarity", "Quantity", "Scryfall ID", "Condition", "Language"])).toBe("manabox-csv");
  });
  it("parses ManaBox rows", () => {
    const csv = `Name,Set code,Set name,Collector number,Foil,Rarity,Quantity,Scryfall ID,Condition,Language\nLightning Bolt,m10,Magic 2010,146,foil,Common,4,abc123,NM,en\n"Athreos, God of Passage",jou,Journey into Nyx,146,,Mythic,1,def456,NM,en`;
    const { format, entries, errors } = parseCollectionCsv(csv);
    expect(format).toBe("manabox-csv");
    expect(errors).toHaveLength(0);
    expect(entries[0]).toMatchObject({ name: "Lightning Bolt", quantity: 4, foil: true, setCode: "m10", scryfallId: "abc123" });
    expect(entries[1]).toMatchObject({ name: "Athreos, God of Passage", foil: false });
  });
  it("parses TCGPlayer rows using Simple Name", () => {
    const csv = `Quantity,Name,Simple Name,Set,Card Number,Set Code,Printing,Condition,Language,Rarity,Product ID,SKU\n1,Verdant Catacombs (Extended Art),Verdant Catacombs,Zendikar,229,ZEN,Foil,Near Mint,English,Rare,33470,315319`;
    const { format, entries } = parseCollectionCsv(csv);
    expect(format).toBe("tcgplayer-csv");
    expect(entries[0]).toMatchObject({ name: "Verdant Catacombs", setCode: "zen", foil: true, quantity: 1 });
  });
});
