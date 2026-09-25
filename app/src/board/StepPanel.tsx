import { Fragment, type ReactNode } from "react";
import type { BoardSnapshot } from "../core/trainer/boardState";
import { citationsIn, PHASE_LABEL, type Timeline, type TimelineStep } from "../core/trainer/timeline";
import type { CardOracle, Zone } from "../core/types";
import b from "./board.module.css";

/**
 * Step panel (spec §Step panel): what happened, the cards involved, the ledger, WHY with CR
 * citations that open the rules viewer, and the BREAK POINT — the interaction that stops this
 * step and what to do instead. Opponent turns also show the track's board summary.
 */

const ZONE_WORD: Record<Zone, string> = { library: "library", hand: "hand", stack: "the stack", battlefield: "the battlefield", graveyard: "graveyard", exile: "exile", command: "the command zone" };

const ACTION_TITLE: Record<string, string> = {
  "begins-on-battlefield": "Begins the game on the battlefield",
  cast: "Cast",
  resolve: "Resolves",
  "cast+resolve": "Cast and resolves",
  "play-land": "Land drop",
  attack: "Attacks",
  trigger: "Triggers",
  sacrifice: "Sacrificed",
  discard: "Discarded",
  reanimate: "Returns to the battlefield",
  destroy: "Destroyed",
  exile: "Exiled",
  hold: "Holds up mana",
  draw: "Draws",
  tutor: "Searches",
};

export function StepPanel({
  timeline,
  step,
  snapshot,
  cardOf,
  onCite,
}: {
  timeline: Timeline;
  step: TimelineStep | undefined;
  snapshot: BoardSnapshot;
  cardOf: (name: string) => CardOracle | undefined;
  onCite: (kind: "CR" | "MTR", ref: string) => void;
}) {
  const ledger = snapshot.ledger;
  const lastIndex = timeline.steps.length - 1;
  const atEnd = step?.index === lastIndex;

  if (!step) {
    return (
      <aside className={b.panel} aria-label="Step details">
        <div className={b.panelWhen}>Opening board</div>
        <h2 className={b.panelTitle}>{timeline.playline.title}</h2>
        <p className={b.summary}>{timeline.playline.strategy.rationale}</p>
        {timeline.track && (
          <div className={b.panelSection}>
            <span className={b.panelLabel}>Opponent</span>
            <p className={b.summary}>
              <strong>{timeline.track.name}</strong> — {timeline.track.description}
            </p>
          </div>
        )}
        <Ledger ledger={ledger} />
        <p className={b.kbdHint}>Press → to step, Space to play. Steps with a break point are the ones to study.</p>
      </aside>
    );
  }

  const turnInfo = timeline.turns.find((t) => t.gameTurn === step.gameTurn);
  const title = `${ACTION_TITLE[step.action.toLowerCase()] ?? step.action}: ${step.cardName.replace(/^\[|\]$/g, "")}`;
  const cites = citationsIn(step.note);
  const oracle = cardOf(step.cardName);
  const cost = step.manaSpent ?? (step.action.toLowerCase().startsWith("cast") ? oracle?.cmc : undefined);

  return (
    <aside className={b.panel} aria-label="Step details">
      <div className={b.panelWhen}>
        <span className={step.actor === "you" ? b.actorYou : b.actorOpp}>{step.actor === "you" ? "You" : "Opponent"}</span>
        <span>· turn {step.turn}</span>
        <span>· {PHASE_LABEL[step.phase ?? "main1"]}</span>
        <span>· step {step.index + 1}</span>
      </div>
      <h2 className={b.panelTitle}>{title}</h2>
      <div className={b.panelCards}>
        {oracle && <span>{oracle.typeLine}</span>}
        {cost !== undefined && cost > 0 && <span>· costs {cost} mana</span>}
        {step.causedBy?.length ? (
          <span>
            · via <strong>{step.causedBy.join(", ")}</strong>
          </span>
        ) : null}
        {step.from !== step.to && (
          <span>
            · {ZONE_WORD[step.from]} → {ZONE_WORD[step.to]}
          </span>
        )}
      </div>

      {step.note && (
        <div className={b.panelSection}>
          <span className={b.panelLabel}>Why</span>
          <p className={b.why}>{withCitations(step.note, cites, onCite)}</p>
        </div>
      )}

      {step.breakPoint && (
        <div className={b.breakPoint} role="note">
          <strong>Break point</strong>
          {step.breakPoint}
        </div>
      )}

      {step.actor === "opponent" && turnInfo?.boardSummary && (
        <div className={b.panelSection}>
          <span className={b.panelLabel}>Their board after this turn</span>
          <p className={b.summary}>{turnInfo.boardSummary}</p>
        </div>
      )}

      <Ledger ledger={ledger} />

      {atEnd && timeline.playline.outcome && (
        <p className={b.outcome}>
          <strong>Outcome:</strong> {withCitations(timeline.playline.outcome, citationsIn(timeline.playline.outcome), onCite)}
        </p>
      )}
    </aside>
  );
}

function Ledger({ ledger }: { ledger: BoardSnapshot["ledger"] }) {
  return (
    <div className={b.panelSection}>
      <span className={b.panelLabel}>Ledger</span>
      <div className={b.ledger}>
        <Row k="Your life" v={ledger.life.you} />
        <Row k="Their life" v={ledger.life.opponent} />
        <Row k="Cards in your hand" v={ledger.cardsInHand.you} />
        <Row k="Cards in their hand" v={ledger.cardsInHand.opponent} />
        <Row k="Mana spent this turn" v={ledger.manaSpentThisTurn} />
        <Row k="Damage you dealt" v={ledger.damageDealt.you} />
      </div>
    </div>
  );
}

function Row({ k, v }: { k: string; v: number }) {
  return (
    <div className={b.ledgerRow}>
      <span className={b.ledgerKey}>{k}</span>
      <span className={b.ledgerVal}>{v}</span>
    </div>
  );
}

/** Render a note with each `CR 603.6c` / `MTR 4.2` token turned into a citation button. */
function withCitations(text: string, cites: ReturnType<typeof citationsIn>, onCite: (kind: "CR" | "MTR", ref: string) => void): ReactNode {
  if (cites.length === 0) return text;
  const re = /\b(CR|MTR)\s+(\d{1,3}(?:\.\d+[a-z]?)?)/g;
  const parts: ReactNode[] = [];
  let last = 0;
  let i = 0;
  for (const m of text.matchAll(re)) {
    const idx = m.index ?? 0;
    parts.push(<Fragment key={`t${i++}`}>{text.slice(last, idx)}</Fragment>);
    const kind = m[1] as "CR" | "MTR";
    const ref = m[2]!;
    parts.push(
      <button key={`c${i++}`} type="button" className={b.cite} onClick={() => onCite(kind, ref)} title={kind === "CR" ? `Open Comprehensive Rules ${ref}` : `Magic Tournament Rules ${ref}`}>
        {kind} {ref}
      </button>,
    );
    last = idx + m[0].length;
  }
  parts.push(<Fragment key={`t${i++}`}>{text.slice(last)}</Fragment>);
  return parts;
}
