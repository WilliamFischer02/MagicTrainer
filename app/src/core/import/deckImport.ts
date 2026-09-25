import { parseCollectionCsv } from "../parsers/collection";
import { countCards, parseDecklist } from "../parsers/decklist";
import type { CollectionEntry, Deck, DeckEntry, Format } from "../types";

/**
 * Turns an imported file (or pasted text) into a `Deck` plus import-time warnings.
 * Framework-free. Resolution against the card DB happens afterwards
 * (`data/nameIndex.ts::resolveDeckNames`); this step only shapes and sanity-checks.
 */

export const FORMATS: readonly Format[] = ["commander", "modern", "standard", "pioneer", "legacy", "vintage", "pauper", "brawl", "casual"];

export interface ImportedDeck {
  deck: Deck;
  /** Non-fatal observations for the review screen (never silently dropped). */
  warnings: string[];
  /** CSV row-level parse errors, if the source was a CSV. */
  errors: string[];
}

export interface ImportOptions {
  /** File name (with or without extension); used for the default deck name and CSV detection. */
  fileName?: string;
  /** Explicit deck name override. */
  name?: string;
  id?: string;
}

/** "athreos-aristocrats.txt" → "Athreos Aristocrats"; "My Deck (1).csv" → "My Deck (1)". */
export function deckNameFromFileName(fileName: string): string {
  const stem = fileName.replace(/^.*[\\/]/, "").replace(/\.[A-Za-z0-9]{1,6}$/, "").trim();
  if (!stem) return "Untitled deck";
  if (/[-_]/.test(stem) && !/\s/.test(stem)) {
    return stem
      .split(/[-_]+/)
      .filter(Boolean)
      .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
      .join(" ");
  }
  return stem;
}

/** A leading comment such as `// WB Athreos Commander — "Athreos" (aristocrats)` names the deck "Athreos". */
export function deckNameFromComment(raw: string): string | undefined {
  for (const line of raw.split(/\r?\n/).slice(0, 5)) {
    const m = /^\s*(?:\/\/|#)\s*(.*)$/.exec(line);
    if (!m) continue;
    const quoted = /[“"']([^”"']{2,60})[”"']/.exec(m[1]);
    if (quoted) return quoted[1].trim();
  }
  return undefined;
}

/** `// format: commander` or `# Format: Modern` in the first lines. */
export function formatFromComment(raw: string): Format | undefined {
  for (const line of raw.split(/\r?\n/).slice(0, 8)) {
    const m = /^\s*(?:\/\/|#).*?\bformat\s*[:=]\s*([A-Za-z]+)/i.exec(line);
    if (!m) continue;
    const f = m[1].toLowerCase();
    return FORMATS.find((x) => x === f);
  }
  return undefined;
}

/** Best guess when nothing states the format: commanders → commander; 60-card → modern-ish "casual" otherwise. */
export function inferFormat(deck: Pick<Deck, "commanders" | "main" | "sideboard">): Format | undefined {
  if (deck.commanders.length > 0) return "commander";
  const main = countCards(deck.main);
  if (main === 99 || main === 100) return "commander";
  if (main >= 60 && main <= 61 && countCards(deck.sideboard) <= 15) return undefined; // constructed; let the user pick
  return undefined;
}

export function deckFromCollectionEntries(entries: readonly CollectionEntry[], opts: { id?: string; name: string; raw: string; sourceFormat: Deck["source"]["format"] }): Deck {
  const main: DeckEntry[] = [];
  for (const c of entries) {
    const existing = main.find((e) => e.name.toLowerCase() === c.name.toLowerCase() && e.setCode === c.setCode);
    if (existing) existing.quantity += c.quantity;
    else main.push({ name: c.name, quantity: c.quantity, setCode: c.setCode, collectorNumber: c.collectorNumber });
  }
  return {
    id: opts.id ?? newDeckId(),
    name: opts.name,
    commanders: [],
    main,
    sideboard: [],
    extra: {},
    source: { format: opts.sourceFormat, raw: opts.raw },
  };
}

function looksLikeCsv(text: string, fileName?: string): boolean {
  if (fileName && /\.csv$/i.test(fileName)) return true;
  const head = text.split(/\r?\n/, 3).map((l) => l.trim()).filter(Boolean);
  const first = head[0] ?? "";
  // A CSV header has several comma-separated cells and no leading quantity.
  return first.split(",").length >= 3 && !/^\d+\s*x?\s/i.test(first);
}

/** Sanity checks that never block saving but should be visible on the review screen. */
export function deckWarnings(deck: Deck): string[] {
  const w: string[] = [];
  const main = countCards(deck.main);
  const total = main + countCards(deck.commanders);
  if (total === 0) w.push("No cards were recognized. Check the format: one card per line as “1 Sol Ring”, or a ManaBox / TCGplayer / Moxfield CSV.");
  const format = deck.format;
  if (format === "commander") {
    if (deck.commanders.length === 0) w.push("No commander section found — add a “Commander” header above the commander line, or set one on the review screen.");
    if (total !== 100 && total > 0) w.push(`Commander decks are exactly 100 cards; this list has ${total}.`);
    const dupes = deck.main.filter((e) => e.quantity > 1 && !isBasicLand(e.name));
    if (dupes.length) w.push(`Singleton rule: ${dupes.map((d) => `${d.quantity}× ${d.name}`).join(", ")}.`);
  } else if (format && format !== "casual") {
    if (main < 60 && main > 0) w.push(`${format} decks need at least 60 cards in the main deck; this list has ${main}.`);
    if (countCards(deck.sideboard) > 15) w.push(`Sideboards are capped at 15 cards; this one has ${countCards(deck.sideboard)}.`);
    const over = deck.main.filter((e) => e.quantity > 4 && !isBasicLand(e.name));
    if (over.length) w.push(`More than four copies: ${over.map((d) => `${d.quantity}× ${d.name}`).join(", ")}.`);
  }
  const extras = Object.keys(deck.extra);
  if (extras.length) w.push(`Extra sections kept but not analyzed: ${extras.join(", ")}.`);
  return w;
}

const BASICS = new Set(["plains", "island", "swamp", "mountain", "forest", "wastes", "snow-covered plains", "snow-covered island", "snow-covered swamp", "snow-covered mountain", "snow-covered forest", "snow-covered wastes"]);
export function isBasicLand(name: string): boolean {
  return BASICS.has(name.trim().toLowerCase());
}

/** Parse text or CSV into a deck. Never throws on content; malformed rows become `errors`. */
export function importDeck(text: string, opts: ImportOptions = {}): ImportedDeck {
  const raw = text.replace(/^﻿/, "");
  const nameFromFile = opts.fileName ? deckNameFromFileName(opts.fileName) : undefined;
  if (looksLikeCsv(raw, opts.fileName)) {
    const parsed = parseCollectionCsv(raw);
    const name = opts.name ?? nameFromFile ?? "Imported deck";
    const deck = deckFromCollectionEntries(parsed.entries, { id: opts.id, name, raw, sourceFormat: parsed.format });
    deck.format = inferFormat(deck);
    const warnings = deckWarnings(deck);
    if (parsed.format === "unknown") warnings.unshift("CSV columns were not recognized as ManaBox, TCGplayer, or Moxfield; rows were read by best effort.");
    return { deck, warnings, errors: parsed.errors };
  }
  const name = opts.name ?? deckNameFromComment(raw) ?? nameFromFile ?? "Untitled deck";
  const deck = parseDecklist(raw, { id: opts.id, name });
  deck.format = formatFromComment(raw) ?? inferFormat(deck);
  return { deck, warnings: deckWarnings(deck), errors: [] };
}

export function newDeckId(): string {
  const g = globalThis as unknown as { crypto?: { randomUUID?: () => string } };
  return g.crypto?.randomUUID?.() ?? `deck_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}
