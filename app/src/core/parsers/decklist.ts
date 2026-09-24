import type { Deck, DeckEntry, ImportFormat } from "../types";

/**
 * Parses text decklists in the common interchange dialects:
 *  - "1 Sol Ring"                (Moxfield/Archidekt/TCGPlayer/MTGO text)
 *  - "1x Sol Ring"               (some sites)
 *  - "1 Sol Ring (C21) 263"      (MTG Arena export; set + collector number)
 *  - "1 Sol Ring [C21]"          (Cockatrice-ish)
 *  - Section headers: "Commander", "Deck", "Main", "Sideboard", "Maybeboard", "Companion"
 *  - "SB: 1 Card" prefix (MTGO)
 *  - Comment lines starting with // or #
 *
 * This parser is intentionally forgiving; strict validation happens after card resolution.
 */

const SECTION_RE = /^\s*(?:\/\/\s*)?(commander|commanders|deck|main|mainboard|maindeck|sideboard|maybeboard|companion|considering|tokens?)\s*:?\s*(?:\(\d+\))?\s*$/i;
const LINE_RE = /^\s*(?:(SB):\s*)?(\d+)\s*x?\s+(.+?)\s*$/i;
const ARENA_SUFFIX_RE = /^(.*?)\s+\(([A-Z0-9]{2,6})\)\s+([0-9A-Za-z★†-]+)\s*(?:\*[FE]\*)?$/;
const BRACKET_SET_RE = /^(.*?)\s+\[([A-Z0-9]{2,6})\](?:\s+([0-9A-Za-z-]+))?$/;

type Section = "commanders" | "main" | "sideboard" | string;

function normalizeSection(raw: string): Section {
  const s = raw.toLowerCase();
  if (s.startsWith("commander")) return "commanders";
  if (["deck", "main", "mainboard", "maindeck"].includes(s)) return "main";
  if (s === "sideboard") return "sideboard";
  return s; // maybeboard, companion, tokens, considering...
}

export function parseDeckLine(line: string): { section?: Section; entry?: DeckEntry } | null {
  const trimmed = line.trim();
  if (!trimmed) return null;
  if (/^(\/\/|#)/.test(trimmed) && !SECTION_RE.test(trimmed)) return null; // comment

  const sec = SECTION_RE.exec(trimmed);
  if (sec) return { section: normalizeSection(sec[1]) };

  const m = LINE_RE.exec(trimmed);
  if (!m) return null;
  const [, sb, qty, rest] = m;
  let name = rest.trim();
  let setCode: string | undefined;
  let collectorNumber: string | undefined;

  const arena = ARENA_SUFFIX_RE.exec(name);
  if (arena) {
    name = arena[1].trim();
    setCode = arena[2].toLowerCase();
    collectorNumber = arena[3];
  } else {
    const br = BRACKET_SET_RE.exec(name);
    if (br) {
      name = br[1].trim();
      setCode = br[2].toLowerCase();
      collectorNumber = br[3];
    }
  }
  // Moxfield may append " *F*" for foil; strip.
  name = name.replace(/\s*\*[FE]\*\s*$/i, "").trim();

  const entry: DeckEntry = { name, quantity: Number(qty), setCode, collectorNumber };
  return { section: sb ? "sideboard" : undefined, entry };
}

export function detectTextDialect(raw: string): ImportFormat {
  const firstCardLine = raw.split(/\r?\n/).find((l) => LINE_RE.test(l)) ?? "";
  const rest = LINE_RE.exec(firstCardLine)?.[3] ?? "";
  return ARENA_SUFFIX_RE.test(rest) ? "arena-text" : "decklist-text";
}

export function parseDecklist(raw: string, opts: { id?: string; name?: string } = {}): Deck {
  const deck: Deck = {
    id: opts.id ?? cryptoRandomId(),
    name: opts.name ?? "Untitled deck",
    commanders: [],
    main: [],
    sideboard: [],
    extra: {},
    source: { format: detectTextDialect(raw), raw },
  };

  let current: Section = "main";
  for (const line of raw.split(/\r?\n/)) {
    const parsed = parseDeckLine(line);
    if (!parsed) continue;
    if (parsed.section && !parsed.entry) {
      current = parsed.section;
      continue;
    }
    if (!parsed.entry) continue;
    push(deck, parsed.section ?? current, parsed.entry);
  }
  return deck;
}

function push(deck: Deck, section: Section, entry: DeckEntry) {
  const list =
    section === "commanders"
      ? deck.commanders
      : section === "main"
        ? deck.main
        : section === "sideboard"
          ? deck.sideboard
          : (deck.extra[section] ??= []);
  const existing = list.find(
    (e) => e.name.toLowerCase() === entry.name.toLowerCase() && e.setCode === entry.setCode,
  );
  if (existing) existing.quantity += entry.quantity;
  else list.push(entry);
}

export function countCards(entries: DeckEntry[]): number {
  return entries.reduce((n, e) => n + e.quantity, 0);
}

function cryptoRandomId(): string {
  const g = globalThis as unknown as { crypto?: { randomUUID?: () => string } };
  return g.crypto?.randomUUID?.() ?? `deck_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}
