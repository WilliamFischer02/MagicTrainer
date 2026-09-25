import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { BoardScene } from "../../board/BoardScene";
import { StepPanel } from "../../board/StepPanel";
import { Timeline } from "../../board/Timeline";
import { rulesGet } from "../../bridge/rules";
import { detectStrategies, type ResolvedCard } from "../../core/strategy/detector";
import { deriveSnapshots } from "../../core/trainer/boardState";
import { mergeTimeline } from "../../core/trainer/timeline";
import { buildPlaylines, isPermanentType } from "../../core/trajectory/templates";
import type { CardOracle, Deck, Playline } from "../../core/types";
import { defaultTrackFor, TRACK_LOAD_ERRORS, TRACKS } from "../../data/tracks";
import { Button, Callout, Card, EmptyState, Page, Spinner, formatCount } from "../components";
import { AlertIcon, DeckIcon, TrainerIcon } from "../icons";
import { useCards, useDeck, useDecks, useNameIndex } from "../queries";
import { useAppStore } from "../store";
import d from "./decks.module.css";
import s from "./screens.module.css";
import t from "./trainer.module.css";

/**
 * Deck Trainer: pick a saved deck → a detected playline → an opponent track → watch the line
 * on the board. Playback is a position over the merged timeline; snapshots are derived once.
 * Dev: `?mode=trainer&deck=<id>&playline=<id>&track=<id>&pos=<n>`.
 */

export function TrainerScreen() {
  const decks = useDecks();
  const { selectedDeckId, selectDeck } = useAppStore();
  useNameIndex();
  const list = decks.data ?? [];

  useEffect(() => {
    if (!decks.data) return;
    if (selectedDeckId && !decks.data.some((x) => x.id === selectedDeckId)) selectDeck(decks.data[0]?.id ?? null);
    if (!selectedDeckId && decks.data[0]) selectDeck(decks.data[0].id);
  }, [decks.data, selectedDeckId, selectDeck]);

  if (decks.isPending) {
    return (
      <Page title="Trainer" subtitle="Watch a deck's winning line play out against a scripted opponent.">
        <div className={s.state} role="status">
          <Spinner /> Loading your decks…
        </div>
      </Page>
    );
  }
  if (list.length === 0) {
    return (
      <Page title="Trainer" subtitle="Watch a deck's winning line play out against a scripted opponent.">
        <EmptyState icon={<DeckIcon />} title="No decks to train with" body="Switch to Builder and import a deck first. The Trainer animates the strategies the Builder detects." />
      </Page>
    );
  }

  return (
    <Page title="Trainer" subtitle="Pick a deck and a line; step through it against a scripted opponent. Break points are the moments to study.">
      {selectedDeckId ? (
        <TrainerForDeck
          id={selectedDeckId}
          deckPicker={
            <label className={t.control}>
              <span className={d.label}>Deck</span>
              <select className={d.select} value={selectedDeckId} onChange={(e) => selectDeck(e.target.value)} aria-label="Deck">
                {list.map((deck) => (
                  <option key={deck.id} value={deck.id}>
                    {deck.name}
                    {deck.format ? ` · ${deck.format}` : ""}
                  </option>
                ))}
              </select>
            </label>
          }
        />
      ) : null}
    </Page>
  );
}

function TrainerForDeck({ id, deckPicker }: { id: string; deckPicker: React.ReactNode }) {
  const deck = useDeck(id);
  const ids = useMemo(() => (deck.data ? [...deck.data.commanders, ...deck.data.main].map((e) => e.oracleId).filter((x): x is string => !!x) : []), [deck.data]);
  const cards = useCards(ids);
  if (deck.isPending || (ids.length > 0 && cards.isPending)) {
    return (
      <div className={s.state} role="status">
        <Spinner /> Preparing the board…
      </div>
    );
  }
  if (deck.error || !deck.data) {
    return (
      <Callout tone="danger" icon={<AlertIcon />}>
        Could not open this deck.
      </Callout>
    );
  }
  return <Trainer key={deck.data.id} deck={deck.data} cards={cards.data ?? new Map()} deckPicker={deckPicker} />;
}

function Trainer({ deck, cards, deckPicker }: { deck: Deck; cards: ReadonlyMap<string, CardOracle>; deckPicker: React.ReactNode }) {
  const params = useMemo(() => new URLSearchParams(globalThis.location?.search ?? ""), []);
  const resolved = useMemo<ResolvedCard[]>(() => {
    const out: ResolvedCard[] = [];
    for (const entry of [...deck.commanders, ...deck.main]) {
      const card = entry.oracleId ? cards.get(entry.oracleId) : undefined;
      if (card) out.push({ entry, card });
    }
    return out;
  }, [deck, cards]);
  const byName = useMemo(() => {
    const m = new Map<string, CardOracle>();
    for (const c of cards.values()) {
      m.set(c.name.toLowerCase(), c);
      const front = c.name.split(" // ")[0];
      if (front) m.set(front.toLowerCase(), c);
    }
    return m;
  }, [cards]);
  const cardOf = useCallback((name: string) => byName.get(name.toLowerCase()), [byName]);

  const playlines = useMemo<Playline[]>(() => buildPlaylines(detectStrategies(resolved), deck.id, { isPermanent: (n) => isPermanentType(cardOf(n)?.typeLine) }), [resolved, deck.id, cardOf]);
  const [playlineId, setPlaylineId] = useState<string | null>(params.get("playline"));
  const playline = playlines.find((p) => p.id === playlineId || p.id.endsWith(`:${playlineId}`)) ?? playlines[0];
  const [trackId, setTrackId] = useState<string | null>(params.get("track"));
  const track = TRACKS.find((x) => x.id === trackId) ?? defaultTrackFor(deck.format);
  const [onThePlay, setOnThePlay] = useState(true);
  const reducedMotion = useMemo(() => globalThis.matchMedia?.("(prefers-reduced-motion: reduce)").matches ?? false, []);

  const timeline = useMemo(() => (playline ? mergeTimeline(playline, track, { onThePlay }) : null), [playline, track, onThePlay]);
  const snapshots = useMemo(() => (timeline ? deriveSnapshots(timeline, deck, { cmcOf: (n) => cardOf(n)?.cmc }) : []), [timeline, deck, cardOf]);

  const [position, setPosition] = useState(() => Math.max(0, Number(params.get("pos") ?? 0) || 0));
  const [playing, setPlaying] = useState(() => params.get("autoplay") === "1");
  const [speed, setSpeed] = useState(1);
  const max = timeline?.steps.length ?? 0;
  useEffect(() => setPosition((p) => Math.min(p, max)), [max]);
  // Reset playback when the line / opponent / play-draw choice changes (StrictMode-safe: compares keys, not run counts).
  const selectionKey = `${playline?.id ?? ""}|${track?.id ?? ""}|${onThePlay}`;
  const lastSelection = useRef(selectionKey);
  useEffect(() => {
    if (lastSelection.current === selectionKey) return;
    lastSelection.current = selectionKey;
    setPosition(0);
    setPlaying(false);
  }, [selectionKey]);

  const timer = useRef<number | null>(null);
  useEffect(() => {
    if (!playing) return;
    if (position >= max) {
      setPlaying(false);
      return;
    }
    const step = timeline?.steps[position];
    const dwell = (step?.breakPoint ? 2600 : step?.note ? 1900 : 1100) / speed;
    timer.current = window.setTimeout(() => setPosition((p) => Math.min(max, p + 1)), dwell);
    return () => {
      if (timer.current) window.clearTimeout(timer.current);
    };
  }, [playing, position, max, speed, timeline]);

  const setContext = useAppStore((st) => st.setContext);
  const navigate = useAppStore((st) => st.navigate);
  const onCite = useCallback(
    (kind: "CR" | "MTR", ref: string) => {
      if (kind !== "CR") {
        navigate("rules");
        return;
      }
      rulesGet(ref)
        .then((entry) => {
          if (entry) setContext({ kind: "rule", entry });
          else navigate("rules");
        })
        .catch((e: unknown) => console.error("rules_get failed", e));
    },
    [setContext, navigate],
  );

  if (playlines.length === 0 || !timeline || !playline) {
    return (
      <div className={t.main}>
        <div className={t.controls}>{deckPicker}</div>
        <Callout tone="info">
          No animated line is available for <strong>{deck.name}</strong> yet. Lines exist for aristocrats, drain loops, reanimator, ramp/stompy, prowess, and affinity decks; the Builder's Strategy panel shows what was detected.
        </Callout>
      </div>
    );
  }
  const snapshot = snapshots[position] ?? snapshots[0]!;
  const step = position > 0 ? timeline.steps[position - 1] : undefined;

  return (
    <div className={t.main}>
      <div className={t.controls}>
        {deckPicker}
        <label className={t.control}>
          <span className={d.label}>Line</span>
          <select className={d.select} value={playline.id} onChange={(e) => setPlaylineId(e.target.value)} aria-label="Playline">
            {playlines.map((p) => (
              <option key={p.id} value={p.id}>
                {p.title} — {p.strategy.label}
              </option>
            ))}
          </select>
        </label>
        <label className={t.control}>
          <span className={d.label}>Opponent</span>
          <select className={d.select} value={track?.id ?? ""} onChange={(e) => setTrackId(e.target.value)} aria-label="Opponent track">
            {TRACKS.map((x) => (
              <option key={x.id} value={x.id}>
                {x.name}
              </option>
            ))}
          </select>
        </label>
        <label className={`${s.check} ${t.checkInline}`}>
          <input type="checkbox" checked={onThePlay} onChange={(e) => setOnThePlay(e.target.checked)} /> You are on the play
        </label>
        <span className={t.stepsMeta}>
          {formatCount(timeline.steps.length)} steps · {timeline.steps.filter((x) => x.breakPoint).length} break points
        </span>
      </div>
      {TRACK_LOAD_ERRORS.length > 0 && (
        <Callout tone="warn" icon={<AlertIcon />}>
          Some opponent tracks failed to load: {TRACK_LOAD_ERRORS.join(" · ")}
        </Callout>
      )}
      <div className={t.stage}>
        <BoardScene snapshot={snapshot} step={step} cardOf={cardOf} reducedMotion={reducedMotion} />
        <StepPanel timeline={timeline} step={step} snapshot={snapshot} cardOf={cardOf} onCite={onCite} />
      </div>
      <Timeline timeline={timeline} position={position} playing={playing} speed={speed} onPosition={setPosition} onTogglePlay={() => setPlaying((p) => !p)} onSpeed={setSpeed} />
      <Card>
        <p className={d.muted} style={{ margin: 0 }}>
          <TrainerIcon /> Tracks are static timelines, not a rules engine: the opponent's plays never react to yours (D-007). Placeholder cards like “[burn spell]” stand for a role until a real list is scripted.
          {track ? ` Opponent: ${track.name}.` : ""}
        </p>
        <div className={d.row} style={{ marginTop: "var(--s-2)" }}>
          <Button size="sm" variant="ghost" onClick={() => setPosition(0)}>
            Reset
          </Button>
        </div>
      </Card>
    </div>
  );
}
