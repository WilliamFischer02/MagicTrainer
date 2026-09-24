/**
 * MagicTrainer core domain model.
 * Framework-free: nothing in src/core may import from React, Tauri, or the DOM.
 * The UI layer (src/ui) and the Tauri bridge (src/bridge) depend on core, never the reverse.
 */

/** Scryfall color letters. */
export type Color = "W" | "U" | "B" | "R" | "G";

/** The seven game zones (CR 400.1) plus the stack. Zone names follow the CR. */
export type Zone =
  | "library"
  | "hand"
  | "battlefield"
  | "graveyard"
  | "stack"
  | "exile"
  | "command";

export const ZONES: readonly Zone[] = [
  "library",
  "hand",
  "stack",
  "battlefield",
  "graveyard",
  "exile",
  "command",
] as const;

/** Minimal card projection stored locally. Sourced from Scryfall oracle-cards bulk data. */
export interface CardOracle {
  oracleId: string;
  name: string;
  manaCost?: string;
  cmc: number;
  typeLine: string;
  oracleText?: string;
  colors: Color[];
  colorIdentity: Color[];
  keywords: string[];
  power?: string;
  toughness?: string;
  loyalty?: string;
  legalities: Record<string, "legal" | "not_legal" | "restricted" | "banned">;
  /** Scryfall Tagger oracle-tag slugs attached to this card (see knowledge/mtg-data-apis/oracle-tag-index.json). */
  oracleTags: string[];
  edhrecRank?: number;
  gameChanger?: boolean;
  /** A representative printing for imagery. */
  imageUris?: { small?: string; normal?: string; large?: string; art_crop?: string };
  /** Representative printing id (scryfall card id). */
  printingId?: string;
  layout: string;
}

/** A physical printing owned by the player (from ManaBox/TCGPlayer collection exports). */
export interface CollectionEntry {
  name: string;
  setCode?: string;
  setName?: string;
  collectorNumber?: string;
  scryfallId?: string;
  quantity: number;
  foil: boolean;
  condition?: string;
  language?: string;
  /** Raw source row for round-tripping/debugging. */
  source: { format: ImportFormat; row: Record<string, string> };
}

export type ImportFormat =
  | "manabox-csv"
  | "tcgplayer-csv"
  | "moxfield-csv"
  | "decklist-text" // "1 Card Name" / "1x Card Name" / MTGO / Moxfield text
  | "arena-text" // "1 Card Name (SET) 123"
  | "unknown";

export type Format =
  | "commander"
  | "modern"
  | "standard"
  | "pioneer"
  | "legacy"
  | "vintage"
  | "pauper"
  | "brawl"
  | "casual";

export interface DeckEntry {
  name: string;
  quantity: number;
  /** Optional set/collector hints from Arena/Moxfield exports. */
  setCode?: string;
  collectorNumber?: string;
  /** Resolved after lookup against the local card DB. */
  oracleId?: string;
}

export interface Deck {
  id: string;
  name: string;
  format?: Format;
  commanders: DeckEntry[];
  main: DeckEntry[];
  sideboard: DeckEntry[];
  /** Companion / maybeboard etc. */
  extra: Record<string, DeckEntry[]>;
  source: { format: ImportFormat; raw: string };
}

/** A recognized strategy/archetype/combo present in a deck. */
export interface StrategyMatch {
  patternId: string;
  label: string;
  /** 0..1 confidence from the detector. */
  confidence: number;
  /** Card names that participate, grouped by role in the pattern. */
  roles: Record<string, string[]>;
  /** Human-readable summary of why the pattern fired. */
  rationale: string;
  /** Optional link to an external source, e.g. a Commander Spellbook variant id. */
  externalRef?: { source: "commander-spellbook" | "edhrec" | "manual"; id: string; url?: string };
}

/** One movement of a card between zones (or a state change within a zone). */
export interface TrajectoryStep {
  step: number;
  cardName: string;
  from: Zone;
  to: Zone;
  /** Why it moved: "cast", "resolve", "etb", "dies", "reanimate", "sacrifice", "draw", "tutor", "attack", "trigger"... */
  action: string;
  /** Free text shown in the step panel; may cite CR rule numbers. */
  note?: string;
  /** Cards that caused this movement (e.g. the sac outlet). */
  causedBy?: string[];
  /** Which player: "you" | "opponent". */
  actor: "you" | "opponent";
  /** Turn number and phase this step happens in. */
  turn?: number;
  phase?: Phase;
}

export type Phase =
  | "untap"
  | "upkeep"
  | "draw"
  | "main1"
  | "beginning-of-combat"
  | "declare-attackers"
  | "declare-blockers"
  | "combat-damage"
  | "end-of-combat"
  | "main2"
  | "end"
  | "cleanup";

/** A scripted line of play the Trainer animates on the board. */
export interface Playline {
  id: string;
  title: string;
  deckId: string;
  strategy: StrategyMatch;
  steps: TrajectoryStep[];
  /** Win condition reached at the end, if any. */
  outcome?: string;
}

/**
 * A pre-built opponent track: a generic, scripted sequence of opposing plays
 * (e.g. "Mono-Red Aggro curve-out", "UW Control with 2 wraths") that the Trainer
 * uses as a placeholder opponent. Tracks never simulate rules; they are timelines.
 */
export interface OpponentTrack {
  id: string;
  name: string;
  archetype: string;
  description: string;
  /** Turn-by-turn scripted events. */
  turns: OpponentTurn[];
}

export interface OpponentTurn {
  turn: number;
  events: TrajectoryStep[];
  /** Threat summary for the coach overlay ("board: 2x 2/2 haste, 3 lands"). */
  boardSummary?: string;
}
