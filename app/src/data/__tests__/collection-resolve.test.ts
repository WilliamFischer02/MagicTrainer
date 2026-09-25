import { readFileSync } from "node:fs";
import { join } from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { importCollection } from "../../core/import/collectionImport";
import type { NameIndex } from "../../core/resolve/resolver";
import { collectionSummary, listCollectionCards, ownedQuantities, resolveCollection } from "../collection";
import { loadNameIndex } from "../nameIndex";
import { NodeDb, localDbPath } from "./nodeDb";

/** Collection resolution against the real printings table. Skipped without `data/magictrainer.sqlite`. */
const dbPath = localDbPath();
const samples = join(__dirname, "../../../../data/samples/collections");

describe.skipIf(!dbPath)("collection resolution (real DB)", () => {
  let db: NodeDb;
  let index: NameIndex;
  beforeAll(async () => {
    db = new NodeDb(dbPath!);
    index = await loadNameIndex(db);
  });
  afterAll(() => db?.close());

  it("resolves ManaBox rows by set + collector number, falling back to name", async () => {
    const { entries } = importCollection(readFileSync(join(samples, "manabox_sample.csv"), "utf8"));
    const rows = await resolveCollection(db, index, entries);
    expect(rows).toHaveLength(entries.length);
    const sol = rows.find((r) => r.entry.name === "Sol Ring")!;
    expect(sol.oracleId).toBeTruthy();
    expect(["scryfall-id", "set-number", "name"]).toContain(sol.method);
    for (const r of rows) expect(r.method, `${r.entry.name} unresolved`).not.toBe("unresolved");
  });

  it("resolves TCGplayer rows (Simple Name + set code) to oracle ids", async () => {
    const { entries } = importCollection(readFileSync(join(samples, "tcgplayer_sample.csv"), "utf8"));
    const rows = await resolveCollection(db, index, entries);
    const bolt = rows.find((r) => r.entry.name === "Lightning Bolt")!;
    expect(bolt.oracleId).toBeTruthy();
    expect(rows.every((r) => r.oracleId)).toBe(true);
  });

  it("reads run against the live schema (empty collection is fine)", async () => {
    const summary = await collectionSummary(db);
    expect(summary.rows).toBeGreaterThanOrEqual(0);
    const cards = await listCollectionCards(db, { text: "sol", colors: ["C"], sort: "price", limit: 5 });
    expect(Array.isArray(cards)).toBe(true);
    const owned = await ownedQuantities(db, [index.resolve("Sol Ring").oracleId!]);
    expect(owned instanceof Map).toBe(true);
  });
});
