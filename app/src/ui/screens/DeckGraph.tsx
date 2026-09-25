import { Background, BackgroundVariant, Controls, Handle, Position, ReactFlow, type Edge, type Node, type NodeProps, type NodeTypes } from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import { useMemo, useState } from "react";
import { cardImageSrc } from "../../bridge/images";
import { buildDeckGraph, GRAPH_CARD_SIZE, type GraphNode } from "../../core/graph/deckGraph";
import { detectStrategies, type ResolvedCard } from "../../core/strategy/detector";
import { includedCombos } from "../../core/strategy/spellbook";
import type { CardOracle, Deck } from "../../core/types";
import { Callout, ExternalLink } from "../components";
import { AlertIcon } from "../icons";
import { useDeckCombos } from "../queries";
import { usePrefs } from "../store";
import g from "./graph.module.css";

/**
 * Deck graph (Phase 2): React Flow over `core/graph/deckGraph`. Card nodes show art + name + copies,
 * role hubs group cards by the strategy role they fill, combo hubs link Spellbook combo pieces.
 * Positions come from the deterministic core layout; the user can pan/zoom and drag nodes.
 */

type CardNodeData = { node: GraphNode };
type HubNodeData = { node: GraphNode };

function CardNode({ data }: NodeProps<Node<CardNodeData>>) {
  const { node } = data;
  const card = node.card as CardOracle;
  const art = cardImageSrc(card.imageUris?.art_crop);
  return (
    <div className={g.cardNode} style={{ width: GRAPH_CARD_SIZE.w, height: GRAPH_CARD_SIZE.h }} title={`${card.name} — ${card.typeLine}`}>
      <Handle type="target" position={Position.Top} className={g.handle} />
      {art ? <img className={g.cardArt} src={art} alt="" loading="lazy" decoding="async" /> : <span className={g.cardArtEmpty} aria-hidden="true" />}
      <span className={g.cardName}>{card.name}</span>
      {(node.quantity ?? 1) > 1 && <span className={g.cardQty}>×{node.quantity}</span>}
    </div>
  );
}

function HubNode({ data }: NodeProps<Node<HubNodeData>>) {
  const { node } = data;
  return (
    <div className={`${g.hub} ${node.kind === "combo" ? g.hubCombo : g.hubRole}`} title={node.patternLabel}>
      <Handle type="source" position={Position.Bottom} className={g.handle} />
      <span className={g.hubKind}>{node.kind === "combo" ? "combo" : "role"}</span>
      <span className={g.hubLabel}>{node.label}</span>
      <span className={g.hubMeta}>{node.members} card{node.members === 1 ? "" : "s"}</span>
    </div>
  );
}

const nodeTypes: NodeTypes = { card: CardNode, role: HubNode, combo: HubNode };

export function DeckGraph({ deck, cards }: { deck: Deck; cards: ReadonlyMap<string, CardOracle> }) {
  const resolved = useMemo<ResolvedCard[]>(() => {
    const out: ResolvedCard[] = [];
    for (const entry of [...deck.commanders, ...deck.main]) {
      const card = entry.oracleId ? cards.get(entry.oracleId) : undefined;
      if (card) out.push({ entry, card });
    }
    return out;
  }, [deck, cards]);
  const matches = useMemo(() => detectStrategies(resolved), [resolved]);
  const autoCombos = usePrefs((p) => p.autoCombos);
  const combos = useDeckCombos(deck, autoCombos);
  const combosIncluded = useMemo(() => (combos.data ? includedCombos(combos.data.results) : []), [combos.data]);
  const [maxHubs, setMaxHubs] = useState(8);

  const graph = useMemo(
    () => buildDeckGraph({ cards: resolved.map((rc) => ({ card: rc.card, quantity: rc.entry.quantity })), matches, combos: combosIncluded, maxHubs }),
    [resolved, matches, combosIncluded, maxHubs],
  );
  const nodes = useMemo<Node[]>(
    () =>
      graph.nodes.map((n) => ({
        id: n.id,
        type: n.kind,
        position: { x: n.x, y: n.y },
        data: { node: n },
        draggable: true,
        selectable: true,
      })),
    [graph],
  );
  const edges = useMemo<Edge[]>(
    () =>
      graph.edges.map((e) => ({
        id: e.id,
        source: e.source,
        target: e.target,
        className: e.kind === "combo" ? g.edgeCombo : g.edgeRole,
        type: "smoothstep",
        animated: e.kind === "combo",
      })),
    [graph],
  );

  if (resolved.length === 0) {
    return (
      <Callout tone="warn" icon={<AlertIcon />}>
        No matched cards to draw. Re-import the list to run the name fixer.
      </Callout>
    );
  }
  if (graph.nodes.length === 0) {
    return (
      <Callout tone="info">
        No strategy roles or combos fired for this deck, so there is nothing to connect yet. The graph fills in as patterns match.
      </Callout>
    );
  }

  return (
    <div className={g.wrap}>
      <div className={g.toolbar}>
        <span className={g.legend}>
          <span className={`${g.swatch} ${g.swatchRole}`} aria-hidden="true" /> role hub
          <span className={`${g.swatch} ${g.swatchCombo}`} aria-hidden="true" /> combo
          <span className={g.legendNote}>
            · {graph.nodes.filter((n) => n.kind === "card").length} cards drawn · {graph.unconnected.length} not in any role
          </span>
        </span>
        <label className={g.hubControl}>
          Hubs
          <select value={maxHubs} onChange={(e) => setMaxHubs(Number(e.target.value))} aria-label="Maximum hubs drawn">
            {[4, 6, 8, 12, 16].map((n) => (
              <option key={n} value={n}>
                {n}
              </option>
            ))}
          </select>
        </label>
      </div>
      <div className={g.canvas} role="img" aria-label={`Deck graph with ${graph.nodes.length} nodes and ${graph.edges.length} edges`}>
        <ReactFlow nodes={nodes} edges={edges} nodeTypes={nodeTypes} fitView fitViewOptions={{ padding: 0.15 }} minZoom={0.2} maxZoom={2} proOptions={{ hideAttribution: true }} nodesConnectable={false} colorMode="dark">
          <Background variant={BackgroundVariant.Dots} gap={24} size={1} />
          <Controls showInteractive={false} />
        </ReactFlow>
      </div>
      {combos.data?.results.included.length ? (
        <p className={g.credit}>
          Combo clusters by <ExternalLink href="https://commanderspellbook.com">Commander Spellbook</ExternalLink>.
        </p>
      ) : null}
    </div>
  );
}
