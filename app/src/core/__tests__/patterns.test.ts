import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { PATTERNS } from "../strategy/patterns";

/** Every oracle-tag slug a pattern relies on must exist in the committed Tagger index (D-008). */
const index = JSON.parse(readFileSync(join(__dirname, "../../../../knowledge/mtg-data-apis/oracle-tag-index.json"), "utf8")) as {
  tags: { slug: string }[];
};
const known = new Set(index.tags.map((t) => t.slug));

describe("pattern tag slugs exist in the Scryfall Tagger index", () => {
  expect(known.size).toBeGreaterThan(4000);
  for (const p of PATTERNS) {
    for (const r of p.roles) {
      it(`${p.id}.${r.id}`, () => {
        const missing = (r.tags ?? []).filter((t) => !known.has(t));
        expect(missing).toEqual([]);
      });
    }
  }
});

describe("pattern definitions are well-formed", () => {
  for (const p of PATTERNS) {
    it(p.id, () => {
      const ids = new Set(p.roles.map((r) => r.id));
      for (const req of p.required) expect(ids.has(req)).toBe(true);
      for (const r of p.roles) {
        expect(r.min).toBeGreaterThan(0);
        expect(r.weight).toBeGreaterThan(0);
        expect(r.tags || r.text || r.type || r.custom).toBeTruthy();
      }
    });
  }
});
