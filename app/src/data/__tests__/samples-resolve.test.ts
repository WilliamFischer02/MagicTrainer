import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { parseDecklist } from "../../core/parsers/decklist";
import { detectStrategies, resolveDeck } from "../../core/strategy/detector";
import { getCardsByOracleIds, getMeta, getRulings, searchCardNames } from "../cards";
import { loadNameIndex, resolveDeckNames } from "../nameIndex";
import { NodeDb, localDbPath } from "./nodeDb";
import type { NameIndex } from "../../core/resolve/resolver";

/**
 * Phase 1 proof: every one of William's six decks resolves with 0 unresolved names against
 * the real Scryfall import. Skipped (not failed) when the local DB has not been built:
 *   cd app/src-tauri && cargo run --bin magictrainer-import -- --data ../../data
 */
const dbPath = localDbPath();
const decksDir = join(__dirname, "../../../../data/samples/decks");

describe.skipIf(!dbPath)("real card DB (data/magictrainer.sqlite)", () => {
  let db: NodeDb;
  let index: NameIndex;

  beforeAll(async () => {
    db = new NodeDb(dbPath!);
    index = await loadNameIndex(db);
  });
  afterAll(() => db?.close());

  it("has a schema version and ≥ 30k playable cards", async () => {
    const meta = await getMeta(db);
    expect(meta.schema_version).toBe("1");
    expect(meta["imported.oracle_cards"]).toMatch(/^\d{4}-\d{2}-\d{2}T/);
    expect(index.size).toBeGreaterThan(30_000);
  });

  for (const file of readdirSync(decksDir).filter((f) => f.endsWith(".txt"))) {
    it(`${file}: 0 unresolved, 0 fuzzy`, () => {
      const deck = parseDecklist(readFileSync(join(decksDir, file), "utf8"), { name: file });
      const r = resolveDeckNames(index, deck);
      expect(r.unresolved.map((u) => u.input)).toEqual([]);
      expect(r.fuzzy.map((f) => `${f.input} → ${f.name}`)).toEqual([]);
      for (const e of [...r.deck.commanders, ...r.deck.main]) expect(e.oracleId).toBeTruthy();
    });
  }

  it("maps rows to CardOracle with ancestor-expanded oracle tags", async () => {
    const r = index.resolve("Blood Artist");
    expect(r.oracleId).toBeTruthy();
    const cards = await getCardsByOracleIds(db, [r.oracleId!]);
    const card = cards.get(r.oracleId!)!;
    expect(card.name).toBe("Blood Artist");
    expect(card.cmc).toBe(2);
    expect(card.colors).toEqual(["B"]);
    expect(card.typeLine).toMatch(/Creature/);
    expect(card.legalities.commander).toBe("legal");
    expect(card.oracleTags).toContain("opponent-loses-life");
    expect(card.oracleTags).toContain("death-trigger"); // ancestor of a direct tag
    expect(card.imageUris?.art_crop).toMatch(/^https:\/\/cards\.scryfall\.io\//);
  });

  it("Athreos deck: detector sees aristocrats + drain loop with real data", async () => {
    const deck = parseDecklist(readFileSync(join(decksDir, "athreos-aristocrats.txt"), "utf8"));
    const resolved = resolveDeckNames(index, deck).deck;
    const ids = [...resolved.commanders, ...resolved.main].map((e) => e.oracleId!).filter(Boolean);
    const cards = await getCardsByOracleIds(db, ids);
    const { cards: rc, unresolved } = resolveDeck(resolved, (name) => {
      const oid = index.resolve(name).oracleId;
      return oid ? cards.get(oid) : undefined;
    });
    expect(unresolved).toEqual([]);
    const matches = detectStrategies(rc);
    const ids2 = matches.map((m) => m.patternId);
    expect(ids2).toContain("aristocrats");
    expect(ids2).toContain("lifegain-drain-loop");
    for (const m of matches) expect(m.rationale.length).toBeGreaterThan(0);
  });

  it("FTS autocomplete and rulings", async () => {
    const hits = await searchCardNames(db, "athreos god");
    expect(hits.map((h) => h.name)).toContain("Athreos, God of Passage");
    const oid = index.resolve("Exquisite Blood").oracleId!;
    const rulings = await getRulings(db, oid);
    expect(Array.isArray(rulings)).toBe(true);
  });
});
