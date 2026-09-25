import type { CardOracle, StrategyMatch } from "../types";

/**
 * Deck graph model for the Builder: cards as nodes, strategy roles as hub nodes with edges to
 * the cards that fill them, and Spellbook combos as cluster hubs linking their pieces.
 * Layout is deterministic (no physics): hubs on a ring, member cards fanned around their hub,
 * shared cards pulled toward the centroid of their hubs. Framework-free; the UI maps this to
 * React Flow nodes/edges. All numbers are in CSS px at zoom 1.
 */

export type GraphNodeKind = "card" | "role" | "combo";

export interface GraphNode {
  id: string;
  kind: GraphNodeKind;
  label: string;
  x: number;
  y: number;
  /** Card nodes only. */
  card?: CardOracle;
  quantity?: number;
  /** Hub nodes: which pattern / combo they belong to. */
  patternId?: string;
  patternLabel?: string;
  /** Hub nodes: number of member cards. */
  members?: number;
  /** Spellbook variant url for combo hubs. */
  url?: string;
}

export interface GraphEdge {
  id: string;
  source: string;
  target: string;
  kind: "role" | "combo";
  /** Role id (for role edges) or "piece" for combo edges. */
  label: string;
}

export interface DeckGraph {
  nodes: GraphNode[];
  edges: GraphEdge[];
  /** Cards that fill no role and sit in no combo (listed, not drawn). */
  unconnected: { card: CardOracle; quantity: number }[];
}

export interface DeckGraphInput {
  cards: readonly { card: CardOracle; quantity: number }[];
  matches: readonly StrategyMatch[];
  /** Spellbook combos already present in the deck (from `includedCombos`). */
  combos?: readonly StrategyMatch[];
  /** Max hubs (patterns + combos) drawn; the rest are dropped by confidence. */
  maxHubs?: number;
}

const CARD_W = 132;
const CARD_H = 44;
const HUB_RING_BASE = 200;
const HUB_RING_PER_HUB = 48;
const FAN_RADIUS = 236;

/** Normalize -0 to 0 so layouts compare equal and serialize cleanly. */
const z = (n: number) => (Object.is(n, -0) ? 0 : n);

function keyOf(name: string): string {
  return name.trim().toLowerCase();
}

/** Build the graph. Deterministic for equal inputs (stable ordering, no randomness). */
export function buildDeckGraph(input: DeckGraphInput): DeckGraph {
  const maxHubs = input.maxHubs ?? 8;
  const byName = new Map<string, { card: CardOracle; quantity: number }>();
  for (const c of input.cards) byName.set(keyOf(c.card.name), c);

  type Hub = { id: string; kind: "role" | "combo"; label: string; patternId: string; patternLabel: string; members: string[]; edgeLabel: string; url?: string; weight: number };
  const hubs: Hub[] = [];
  const sortedMatches = [...input.matches].sort((a, b) => b.confidence - a.confidence);
  for (const m of sortedMatches) {
    for (const [role, names] of Object.entries(m.roles)) {
      const members = names.map(keyOf).filter((n) => byName.has(n));
      if (members.length === 0) continue;
      hubs.push({
        id: `role:${m.patternId}:${role}`,
        kind: "role",
        label: `${m.label.split(" (")[0]} · ${role.replace(/-/g, " ")}`,
        patternId: m.patternId,
        patternLabel: m.label,
        members: [...new Set(members)],
        edgeLabel: role,
        weight: m.confidence,
      });
    }
  }
  for (const c of input.combos ?? []) {
    const members = (c.roles.pieces ?? []).map(keyOf).filter((n) => byName.has(n));
    if (members.length < 2) continue;
    hubs.push({
      id: `combo:${c.externalRef?.id ?? c.patternId}`,
      kind: "combo",
      label: c.label,
      patternId: c.patternId,
      patternLabel: c.label,
      members: [...new Set(members)],
      edgeLabel: "piece",
      url: c.externalRef?.url,
      weight: 1 + c.confidence,
    });
  }
  // Combos first (weight > 1), then roles by confidence; cap the hub count.
  hubs.sort((a, b) => b.weight - a.weight || a.id.localeCompare(b.id));
  const kept = hubs.slice(0, maxHubs);

  const nodes: GraphNode[] = [];
  const edges: GraphEdge[] = [];
  const cardHubs = new Map<string, Hub[]>();
  for (const h of kept) for (const m of h.members) (cardHubs.get(m) ?? cardHubs.set(m, []).get(m)!).push(h);

  // Hubs on a ring (single hub → center).
  const hubPos = new Map<string, { x: number; y: number }>();
  kept.forEach((h, i) => {
    const angle = (2 * Math.PI * i) / Math.max(1, kept.length) - Math.PI / 2;
    const r = kept.length === 1 ? 0 : HUB_RING_BASE + HUB_RING_PER_HUB * kept.length;
    const pos = { x: z(Math.round(Math.cos(angle) * r)), y: z(Math.round(Math.sin(angle) * r)) };
    hubPos.set(h.id, pos);
    nodes.push({ id: h.id, kind: h.kind, label: h.label, x: pos.x, y: pos.y, patternId: h.patternId, patternLabel: h.patternLabel, members: h.members.length, url: h.url });
  });

  // Cards: fan around their hub; shared cards go to the centroid of their hubs (nudged outward so they don't overlap hubs).
  const placed = new Map<string, { x: number; y: number }>();
  for (const h of kept) {
    const own = h.members.filter((m) => (cardHubs.get(m)?.length ?? 0) === 1);
    const center = hubPos.get(h.id)!;
    const outward = Math.atan2(center.y, center.x);
    const perRing = 7;
    own.forEach((m, i) => {
      const ringIdx = Math.floor(i / perRing);
      const inRing = Math.min(perRing, own.length - ringIdx * perRing);
      const slot = i % perRing;
      const spread = Math.min(Math.PI * 1.5, 0.64 * inRing);
      const angle = kept.length === 1 ? (2 * Math.PI * slot) / Math.max(1, inRing) : outward - spread / 2 + (spread * (slot + 0.5)) / inRing;
      const ring = FAN_RADIUS + ringIdx * (CARD_H + 24);
      placed.set(m, { x: z(Math.round(center.x + Math.cos(angle) * ring)), y: z(Math.round(center.y + Math.sin(angle) * ring)) });
    });
  }
  for (const [m, hs] of cardHubs) {
    if (placed.has(m)) continue;
    const cx = hs.reduce((n, h) => n + hubPos.get(h.id)!.x, 0) / hs.length;
    const cy = hs.reduce((n, h) => n + hubPos.get(h.id)!.y, 0) / hs.length;
    // Shared cards sit between hubs; stagger vertically by member index so several don't stack.
    const idx = [...cardHubs.keys()].filter((k) => !placed.has(k) || k === m).indexOf(m);
    placed.set(m, { x: z(Math.round(cx)), y: z(Math.round(cy + (idx % 5) * (CARD_H + 8) - CARD_H * 2)) });
  }
  for (const [m, pos] of placed) {
    const c = byName.get(m)!;
    nodes.push({ id: `card:${c.card.oracleId}`, kind: "card", label: c.card.name, x: pos.x - CARD_W / 2, y: pos.y - CARD_H / 2, card: c.card, quantity: c.quantity });
  }
  for (const h of kept) {
    for (const m of h.members) {
      const c = byName.get(m)!;
      edges.push({ id: `${h.id}->${c.card.oracleId}`, source: h.id, target: `card:${c.card.oracleId}`, kind: h.kind, label: h.edgeLabel });
    }
  }
  const connected = new Set(placed.keys());
  const unconnected = input.cards.filter((c) => !connected.has(keyOf(c.card.name))).sort((a, b) => a.card.name.localeCompare(b.card.name));
  return { nodes, edges, unconnected };
}

/** Bounding box of the graph (for fit-to-view fallbacks and tests). */
export function graphBounds(g: DeckGraph): { minX: number; minY: number; maxX: number; maxY: number } {
  const xs = g.nodes.map((n) => n.x);
  const ys = g.nodes.map((n) => n.y);
  if (xs.length === 0) return { minX: 0, minY: 0, maxX: 0, maxY: 0 };
  return { minX: Math.min(...xs), minY: Math.min(...ys), maxX: Math.max(...xs) + CARD_W, maxY: Math.max(...ys) + CARD_H };
}

export const GRAPH_CARD_SIZE = { w: CARD_W, h: CARD_H } as const;
