import { useEffect } from "react";
import type { Timeline as TimelineModel } from "../core/trainer/timeline";
import { PHASE_LABEL } from "../core/trainer/timeline";
import b from "./board.module.css";

/**
 * Scrubber: position 0 = the opening board, position n = after step n. Turns are major ticks
 * (yours in gold). Keyboard: ← → step, Space play/pause, Home/End jump. Speed multiplies the
 * per-step dwell time.
 */

export const SPEEDS = [0.5, 1, 1.5, 2, 3] as const;

export function Timeline({
  timeline,
  position,
  playing,
  speed,
  onPosition,
  onTogglePlay,
  onSpeed,
}: {
  timeline: TimelineModel;
  position: number;
  playing: boolean;
  speed: number;
  onPosition: (p: number) => void;
  onTogglePlay: () => void;
  onSpeed: (s: number) => void;
}) {
  const max = timeline.steps.length;
  const step = position > 0 ? timeline.steps[position - 1] : undefined;

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement | null;
      if (t && (t.tagName === "INPUT" || t.tagName === "TEXTAREA" || t.tagName === "SELECT" || t.isContentEditable)) return;
      if (e.key === "ArrowRight") {
        e.preventDefault();
        onPosition(Math.min(max, position + 1));
      } else if (e.key === "ArrowLeft") {
        e.preventDefault();
        onPosition(Math.max(0, position - 1));
      } else if (e.key === " ") {
        e.preventDefault();
        onTogglePlay();
      } else if (e.key === "Home") {
        onPosition(0);
      } else if (e.key === "End") {
        onPosition(max);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [max, position, onPosition, onTogglePlay]);

  return (
    <div className={b.timeline} role="group" aria-label="Playback">
      <div className={b.transport}>
        <button type="button" className={b.tbtn} onClick={() => onPosition(0)} disabled={position === 0} title="Start (Home)" aria-label="Go to start">
          ⏮
        </button>
        <button type="button" className={b.tbtn} onClick={() => onPosition(Math.max(0, position - 1))} disabled={position === 0} title="Previous step (←)" aria-label="Previous step">
          ◀
        </button>
        <button type="button" className={`${b.tbtn} ${b.tbtnPrimary}`} onClick={onTogglePlay} title={playing ? "Pause (Space)" : "Play (Space)"} aria-label={playing ? "Pause" : "Play"} aria-pressed={playing}>
          {playing ? "▮▮" : "▶"}
        </button>
        <button type="button" className={b.tbtn} onClick={() => onPosition(Math.min(max, position + 1))} disabled={position >= max} title="Next step (→)" aria-label="Next step">
          ▶
        </button>
        <button type="button" className={b.tbtn} onClick={() => onPosition(max)} disabled={position >= max} title="End (End)" aria-label="Go to end">
          ⏭
        </button>
      </div>
      <div className={b.track}>
        <div className={b.ticks} aria-hidden="true">
          {timeline.turns.map((t, i) => {
            const pct = ((t.firstIndex + 1) / Math.max(1, max)) * 100;
            // Labels of the same player closer than ~6% of the track would overlap: keep the mark, drop the text.
            const prevSame = timeline.turns.slice(0, i).reverse().find((p) => p.activePlayer === t.activePlayer);
            const crowded = prevSame ? pct - ((prevSame.firstIndex + 1) / Math.max(1, max)) * 100 < 6 : false;
            return (
              <span key={t.gameTurn} className={`${b.tick} ${t.activePlayer === "you" ? b.tickYou : b.tickOpp}`} style={{ left: `${pct}%` }} title={`${t.activePlayer === "you" ? "Your" : "Opponent's"} turn ${t.playerTurn}${t.boardSummary ? ` — ${t.boardSummary}` : ""}`}>
                {crowded ? "" : `${t.activePlayer === "you" ? "You" : "Opp"} T${t.playerTurn}`}
              </span>
            );
          })}
        </div>
        <input
          className={b.range}
          type="range"
          min={0}
          max={max}
          step={1}
          value={position}
          onChange={(e) => onPosition(Number(e.target.value))}
          aria-label="Timeline position"
          aria-valuetext={step ? `Step ${position} of ${max}: ${step.action} ${step.cardName}` : "Opening board"}
          list="mt-timeline-ticks"
        />
        <div className={b.position}>
          <span>{step ? `${step.actor === "you" ? "Your" : "Opponent's"} turn ${step.turn} · ${PHASE_LABEL[step.phase ?? "main1"]}` : "Opening board"}</span>
          <span>
            {position} / {max}
          </span>
        </div>
      </div>
      <label className={b.kbdHint}>
        Speed{" "}
        <select className={b.speed} value={speed} onChange={(e) => onSpeed(Number(e.target.value))} aria-label="Playback speed">
          {SPEEDS.map((s) => (
            <option key={s} value={s}>
              {s}×
            </option>
          ))}
        </select>
      </label>
    </div>
  );
}
