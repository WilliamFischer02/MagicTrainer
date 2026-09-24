import { describe, it, expect } from "vitest";
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { parseDecklist, countCards } from "../parsers/decklist";

const dir = join(__dirname, "../../../../data/samples/decks");
const expected: Record<string, { main: number; commanders: number }> = {
  "athreos-aristocrats.txt": { main: 99, commanders: 1 },
  "ghalta-stampede.txt": { main: 99, commanders: 1 },
  "purple-izzet-prowess.txt": { main: 60, commanders: 0 },
  "pink-boros-aggro.txt": { main: 60, commanders: 0 },
  "mono-green-stompy.txt": { main: 60, commanders: 0 },
  "mono-blue-affinity.txt": { main: 60, commanders: 0 },
};

describe("William's sample decklists parse to legal sizes", () => {
  for (const file of readdirSync(dir).filter((f) => f.endsWith(".txt"))) {
    it(file, () => {
      const deck = parseDecklist(readFileSync(join(dir, file), "utf8"), { name: file });
      expect(countCards(deck.main)).toBe(expected[file].main);
      expect(deck.commanders).toHaveLength(expected[file].commanders);
    });
  }
});
