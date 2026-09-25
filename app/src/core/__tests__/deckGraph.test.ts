import { describe, expect, it } from "vitest";
import { buildDeckGraph, graphBounds } from "../graph/deckGraph";
import type { CardOracle, StrategyMatch } from "../types";

/** Stub cards — minimal, NOT real Oracle data. */
const stub = (name: string): CardOracle => ({
  oracleId: `o-${name.toLowerCase().replace(/\W+/g, "-")}`,
  name,
  cmc: 2,
  typeLine: "Creature",
  colors: [],
  colorIdentity: [],
  keywords: [],
  legalities: {},
  oracleTags: [],
  layout: "normal",
});

const cards = ["Viscera Seer", "Blood Artist", "Zulaport Cutthroat", "Exquisite Blood", "Sanguine Bond", "Swamp"].map((n) => ({ card: stub(n), quantity: n === "Swamp" ? 30 : 1 }));

const aristocrats: StrategyMatch = {
  patternId: "aristocrats",
  label: "Aristocrats (sacrifice engine)",
  confidence: 0.9,
  roles: { outlet: ["Viscera Seer"], payoff: ["Blood Artist", "Zulaport Cutthroat"] },
  rationale: "test",
};
const drain: StrategyMatch = {
  patternId: "lifegain-drain-loop",
  label: "Lifegain / life-loss drain loop",
  confidence: 1,
  roles: { "gain-to-drain": ["Sanguine Bond"], "drain-to-gain": ["Exquisite Blood"], starter: ["Blood Artist"] },
  rationale: "test",
};
const combo: StrategyMatch = {
  patternId: "spellbook:690-3966",
  label: "Sanguine Bond + Exquisite Blood",
  confidence: 0.95,
  roles: { pieces: ["Sanguine Bond", "Exquisite Blood"] },
  rationale: "test",
  externalRef: { source: "commander-spellbook", id: "690-3966", url: "https://commanderspellbook.com/combo/690-3966/" },
};

describe("buildDeckGraph", () => {
  it("makes a hub per filled role and per combo, edges to member cards, and lists unconnected cards", () => {
    const g = buildDeckGraph({ cards, matches: [aristocrats, drain], combos: [combo] });
    const hubs = g.nodes.filter((n) => n.kind !== "card");
    expect(hubs.map((h) => h.id).sort()).toEqual(
      ["combo:690-3966", "role:aristocrats:outlet", "role:aristocrats:payoff", "role:lifegain-drain-loop:drain-to-gain", "role:lifegain-drain-loop:gain-to-drain", "role:lifegain-drain-loop:starter"].sort(),
    );
    const cardNodes = g.nodes.filter((n) => n.kind === "card");
    expect(cardNodes.map((n) => n.label).sort()).toEqual(["Blood Artist", "Exquisite Blood", "Sanguine Bond", "Viscera Seer", "Zulaport Cutthroat"]);
    expect(g.unconnected.map((u) => u.card.name)).toEqual(["Swamp"]);
    // Every edge connects an existing hub to an existing card node.
    const ids = new Set(g.nodes.map((n) => n.id));
    for (const e of g.edges) {
      expect(ids.has(e.source)).toBe(true);
      expect(ids.has(e.target)).toBe(true);
    }
    expect(g.edges.filter((e) => e.kind === "combo")).toHaveLength(2);
    expect(g.edges.filter((e) => e.source === "role:aristocrats:payoff")).toHaveLength(2);
  });

  it("is deterministic and spreads nodes so no two card nodes share a position", () => {
    const a = buildDeckGraph({ cards, matches: [aristocrats, drain], combos: [combo] });
    const b = buildDeckGraph({ cards, matches: [aristocrats, drain], combos: [combo] });
    expect(a).toEqual(b);
    const positions = a.nodes.filter((n) => n.kind === "card").map((n) => `${n.x},${n.y}`);
    expect(new Set(positions).size).toBe(positions.length);
    const bounds = graphBounds(a);
    expect(bounds.maxX - bounds.minX).toBeGreaterThan(200);
  });

  it("caps hubs by weight (combos first, then confidence) and centers a lone hub", () => {
    const g = buildDeckGraph({ cards, matches: [aristocrats, drain], combos: [combo], maxHubs: 1 });
    const hubs = g.nodes.filter((n) => n.kind !== "card");
    expect(hubs).toHaveLength(1);
    expect(hubs[0]?.kind).toBe("combo");
    expect(hubs[0]).toMatchObject({ x: 0, y: 0, url: "https://commanderspellbook.com/combo/690-3966/" });
  });

  it("ignores role members that are not in the deck and empty inputs", () => {
    const g = buildDeckGraph({ cards, matches: [{ ...aristocrats, roles: { outlet: ["Not In Deck"] } }] });
    expect(g.nodes).toEqual([]);
    expect(g.unconnected).toHaveLength(cards.length);
    expect(graphBounds(g)).toEqual({ minX: 0, minY: 0, maxX: 0, maxY: 0 });
  });
});
