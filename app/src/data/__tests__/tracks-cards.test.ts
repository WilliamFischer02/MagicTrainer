import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { parseOpponentTrack, trackRealCardNames } from "../../core/opponent/schema";
import type { NameIndex } from "../../core/resolve/resolver";
import { loadNameIndex } from "../nameIndex";
import { NodeDb, localDbPath } from "./nodeDb";

/**
 * Every non-placeholder card name in an opponent track must be a real Scryfall card
 * (OPPONENT_TRACKS.md authoring checklist; D-005 "never fabricate a card"). Skipped without the DB.
 */
const dbPath = localDbPath();
const dir = join(__dirname, "../../../../opponent-tracks");

describe.skipIf(!dbPath)("opponent tracks name real cards (real DB)", () => {
  let db: NodeDb;
  let index: NameIndex;
  beforeAll(async () => {
    db = new NodeDb(dbPath!);
    index = await loadNameIndex(db);
  });
  afterAll(() => db?.close());

  for (const f of readdirSync(dir).filter((x) => x.endsWith(".track.json"))) {
    it(`${f}: every real card name resolves exactly`, () => {
      const r = parseOpponentTrack(JSON.parse(readFileSync(join(dir, f), "utf8")));
      expect(r.errors).toEqual([]);
      const bad = trackRealCardNames(r.track!).filter((n) => {
        const res = index.resolve(n);
        return !res.oracleId || res.method === "fuzzy";
      });
      expect(bad).toEqual([]);
    });
  }
});
