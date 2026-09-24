import { describe, it, expect } from "vitest";
import { parseDecklist } from "../parsers/decklist";
import { resolveDeck, detectStrategies } from "../strategy/detector";
import { buildPlayline } from "../trajectory/templates";
import type { CardOracle } from "../types";

/**
 * Minimal hand-written oracle stubs. Oracle text below is paraphrased for test purposes only —
 * the real app resolves against Scryfall bulk data. Never ship these as card data.
 */
const stub = (name: string, o: Partial<CardOracle>): CardOracle => ({
  oracleId: name.toLowerCase(),
  name,
  cmc: 2,
  typeLine: "Creature",
  colors: [],
  colorIdentity: [],
  keywords: [],
  legalities: {},
  oracleTags: [],
  layout: "normal",
  ...o,
});

const DB: Record<string, CardOracle> = Object.fromEntries(
  [
    stub("Viscera Seer", { oracleText: "Sacrifice a creature: Scry 1.", oracleTags: ["sacrifice-outlet-creature"] }),
    stub("Blood Artist", { oracleText: "Whenever Blood Artist or another creature dies, target player loses 1 life and you gain 1 life.", oracleTags: ["death-trigger-other"] }),
    stub("Zulaport Cutthroat", { oracleText: "Whenever Zulaport Cutthroat or another creature you control dies, each opponent loses 1 life and you gain 1 life." }),
    stub("Endless Cockroaches", { oracleText: "When Endless Cockroaches dies, return it to its owner's hand.", oracleTags: ["recursive-creature"] }),
    stub("Nantuko Husk", { oracleText: "Sacrifice a creature: Nantuko Husk gets +2/+2 until end of turn." }),
    stub("Karmic Guide", { oracleText: "When Karmic Guide enters, return target creature card from your graveyard to the battlefield.", oracleTags: ["reanimation"] }),
    stub("Exquisite Blood", { typeLine: "Enchantment", cmc: 5, oracleText: "Whenever an opponent loses life, you gain that much life." }),
    stub("Sanguine Bond", { typeLine: "Enchantment", cmc: 5, oracleText: "Whenever you gain life, target opponent loses that much life." }),
    stub("Soul Warden", { oracleText: "Whenever another creature enters, you gain 1 life.", oracleTags: ["lifegain", "soul-sister"] }),
    stub("Swamp", { typeLine: "Basic Land — Swamp", cmc: 0 }),
  ].map((c) => [c.name, c]),
);

const lookup = (n: string) => DB[n];

describe("strategy detection on an aristocrats list", () => {
  const deck = parseDecklist(`Commander\n1 Athreos, God of Passage\nDeck\n1 Viscera Seer\n1 Nantuko Husk\n1 Blood Artist\n1 Zulaport Cutthroat\n1 Endless Cockroaches\n1 Karmic Guide\n1 Exquisite Blood\n1 Sanguine Bond\n1 Soul Warden\n30 Swamp`);
  const { cards, unresolved } = resolveDeck(deck, lookup);

  it("reports unresolved names instead of dropping them", () => {
    expect(unresolved).toEqual(["Athreos, God of Passage"]);
  });

  it("fires aristocrats and the drain loop", () => {
    const matches = detectStrategies(cards);
    const ids = matches.map((m) => m.patternId);
    expect(ids).toContain("aristocrats");
    expect(ids).toContain("lifegain-drain-loop");
    const drain = matches.find((m) => m.patternId === "lifegain-drain-loop")!;
    expect(drain.roles["gain-to-drain"]).toEqual(["Sanguine Bond"]);
    expect(drain.roles["drain-to-gain"]).toEqual(["Exquisite Blood"]);
    expect(drain.confidence).toBeGreaterThan(0.8);
  });

  it("does not fire reanimator (no big targets)", () => {
    expect(detectStrategies(cards).map((m) => m.patternId)).not.toContain("reanimator");
  });

  it("builds an animatable playline with zone transitions", () => {
    const m = detectStrategies(cards).find((x) => x.patternId === "aristocrats")!;
    const line = buildPlayline(m, deck.id)!;
    expect(line.steps.length).toBeGreaterThan(5);
    expect(line.steps[0]).toMatchObject({ step: 1, from: "hand", to: "stack", action: "cast" });
    const sac = line.steps.find((s) => s.action === "sacrifice")!;
    expect(sac).toMatchObject({ from: "battlefield", to: "graveyard" });
    expect(sac.causedBy).toContain("Viscera Seer");
    expect(line.steps.some((s) => s.from === "graveyard" && s.to === "battlefield")).toBe(true);
  });
});
