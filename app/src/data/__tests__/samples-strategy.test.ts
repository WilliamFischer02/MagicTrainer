import { readFileSync } from "node:fs";
import { join } from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { parseDecklist } from "../../core/parsers/decklist";
import type { NameIndex } from "../../core/resolve/resolver";
import { detectStrategies, resolveDeck, type ResolvedCard } from "../../core/strategy/detector";
import type { StrategyMatch } from "../../core/types";
import { getCardsByOracleIds } from "../cards";
import { loadNameIndex, resolveDeckNames } from "../nameIndex";
import { NodeDb, localDbPath } from "./nodeDb";

/**
 * Golden strategy tests on William's six real decks against the real Scryfall import
 * (STRATEGY_DETECTION.md quality gate; expectations from the strategy-analyst audit 2026-09-24).
 * Skipped when `data/magictrainer.sqlite` is absent.
 */
const dbPath = localDbPath();
const decksDir = join(__dirname, "../../../../data/samples/decks");

interface Golden {
  file: string;
  /** Every one of these must fire. */
  must: string[];
  /** The top match must be one of these. */
  topOneOf: string[];
  /** None of these may fire. */
  mustNot: string[];
}

const GOLDEN: Golden[] = [
  { file: "athreos-aristocrats.txt", must: ["aristocrats", "lifegain-drain-loop"], topOneOf: ["aristocrats", "lifegain-drain-loop"], mustNot: ["reanimator", "voltron", "prowess-tempo", "burn", "control"] },
  { file: "ghalta-stampede.txt", must: ["power-ramp-stompy"], topOneOf: ["power-ramp-stompy"], mustNot: ["voltron", "aristocrats", "go-wide-tokens", "prowess-tempo", "control"] },
  { file: "mono-blue-affinity.txt", must: ["artifact-aggro"], topOneOf: ["artifact-aggro"], mustNot: ["prowess-tempo", "reanimator", "control", "burn"] },
  { file: "mono-green-stompy.txt", must: ["stompy"], topOneOf: ["stompy"], mustNot: ["prowess-tempo", "power-ramp-stompy", "spellslinger", "control"] },
  { file: "pink-boros-aggro.txt", must: ["creature-aggro"], topOneOf: ["creature-aggro", "burn"], mustNot: ["control", "reanimator", "aristocrats"] },
  { file: "purple-izzet-prowess.txt", must: ["prowess-tempo"], topOneOf: ["prowess-tempo", "burn", "spellslinger"], mustNot: ["control", "stompy", "reanimator"] },
];

describe.skipIf(!dbPath)("strategy detection golden tests (real DB)", () => {
  let db: NodeDb;
  let index: NameIndex;
  beforeAll(async () => {
    db = new NodeDb(dbPath!);
    index = await loadNameIndex(db);
  });
  afterAll(() => db?.close());

  async function detect(file: string): Promise<{ matches: StrategyMatch[]; cards: ResolvedCard[] }> {
    const deck = parseDecklist(readFileSync(join(decksDir, file), "utf8"), { name: file });
    const resolved = resolveDeckNames(index, deck).deck;
    const ids = [...resolved.commanders, ...resolved.main].map((e) => e.oracleId).filter((x): x is string => !!x);
    const cardMap = await getCardsByOracleIds(db, ids);
    const { cards, unresolved } = resolveDeck(resolved, (name) => {
      const oid = index.resolve(name).oracleId;
      return oid ? cardMap.get(oid) : undefined;
    });
    expect(unresolved).toEqual([]);
    return { matches: detectStrategies(cards), cards };
  }

  for (const g of GOLDEN) {
    it(`${g.file}: fires ${g.must.join(" + ")}, top ∈ {${g.topOneOf.join(", ")}}`, async () => {
      const { matches } = await detect(g.file);
      const ids = matches.map((m) => m.patternId);
      const summary = matches.map((m) => `${m.patternId}@${m.confidence}`).join(", ");
      for (const id of g.must) expect(ids, `expected ${id} in [${summary}]`).toContain(id);
      expect(g.topOneOf, `top was ${ids[0]} in [${summary}]`).toContain(ids[0]);
      for (const id of g.mustNot) expect(ids, `${id} must not fire: [${summary}]`).not.toContain(id);
      for (const m of matches) {
        expect(m.rationale.length).toBeGreaterThan(0);
        expect(m.confidence).toBeGreaterThan(0);
        expect(m.confidence).toBeLessThanOrEqual(1);
      }
    });
  }
});
