import { describe, expect, it } from "vitest";
import { exportDecklist, exportFileName } from "../export/decklist";
import { parseDecklist } from "../parsers/decklist";
import type { Deck } from "../types";

const deck: Deck = {
  id: "d",
  name: "Athreos, God of Passage",
  format: "commander",
  commanders: [{ name: "Athreos, God of Passage", quantity: 1, setCode: "jou", collectorNumber: "146" }],
  main: [
    { name: "Blood Artist", quantity: 1, setCode: "avr", collectorNumber: "86" },
    { name: "Swamp", quantity: 30 },
  ],
  sideboard: [{ name: "Rest in Peace", quantity: 1 }],
  extra: { maybeboard: [{ name: "Sol Ring", quantity: 1 }] },
  source: { format: "decklist-text", raw: "" },
};

describe("decklist export", () => {
  it("writes the Moxfield dialect with sections and extras", () => {
    expect(exportDecklist(deck, "moxfield")).toBe(
      "Commander\n1 Athreos, God of Passage\n\nDeck\n1 Blood Artist\n30 Swamp\n\nSideboard\n1 Rest in Peace\n\nMaybeboard\n1 Sol Ring\n",
    );
  });

  it("writes the Arena dialect with set and collector number when known", () => {
    const text = exportDecklist(deck, "arena");
    expect(text).toContain("1 Athreos, God of Passage (JOU) 146");
    expect(text).toContain("1 Blood Artist (AVR) 86");
    expect(text).toContain("30 Swamp\n");
    expect(text).not.toContain("Maybeboard");
  });

  it("writes MTGO with SB: prefixes", () => {
    const text = exportDecklist(deck, "mtgo");
    expect(text.split("\n")).toEqual(["// Commander", "1 Athreos, God of Passage", "", "// Deck", "1 Blood Artist", "30 Swamp", "", "SB: 1 Rest in Peace", ""]);
  });

  it("round-trips through the importer", () => {
    for (const dialect of ["moxfield", "arena", "mtgo"] as const) {
      const back = parseDecklist(exportDecklist(deck, dialect));
      expect(back.main.map((e) => [e.name, e.quantity])).toEqual([
        ["Blood Artist", 1],
        ["Swamp", 30],
      ]);
      expect(back.sideboard.map((e) => e.name)).toEqual(["Rest in Peace"]);
      expect(back.commanders.map((e) => e.name)).toEqual(["Athreos, God of Passage"]);
      if (dialect === "arena") expect(back.main[0]?.setCode).toBe("avr");
    }
  });

  it("makes a safe file name", () => {
    expect(exportFileName("Athreos, God of Passage", "moxfield")).toBe("Athreos-God-of-Passage.txt");
    expect(exportFileName("  ", "arena")).toBe("deck-arena.txt");
    expect(exportFileName("Fire // Ice: ünïcode?", "mtgo")).toBe("Fire-Ice-unicode-mtgo.txt");
  });
});
