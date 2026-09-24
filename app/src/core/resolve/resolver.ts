import { looseCardKey, normalizeCardName, splitFaceNames } from "./normalize";

/**
 * Card-name resolution: user-typed / exported names → Scryfall oracle ids.
 *
 * Framework-free. The index is built from a lightweight projection of the local card DB
 * (`{ oracleId, name, layout }` for ~35k oracle cards, ~3 MB) and lives in memory; the
 * data layer (`src/data`) loads it once per session. Matching order and confidence:
 *
 *   1. exact       — normalized full name equals                                        → 1.00
 *   2. face        — normalized name equals one face of a DFC / split / adventure card  → 0.99
 *   3. normalized  — punctuation-insensitive key equals (full or face)                  → 0.97
 *   4. fuzzy       — trigram candidates ranked by Levenshtein similarity ≥ `minFuzzy`   → similarity
 *   5. unresolved  — best candidates returned for a fixer UI, confidence 0
 *
 * Tokens, emblems, art-series and other non-playable layouts are excluded from the index
 * so "Treasure" never resolves to a token.
 */

export interface NameIndexEntry {
  oracleId: string;
  /** Scryfall full name, e.g. "Fire // Ice". */
  name: string;
  /** Scryfall layout, e.g. "normal", "transform", "split", "adventure", "token". */
  layout: string;
}

export type ResolveMethod = "exact" | "face" | "normalized" | "fuzzy";

export interface Candidate {
  oracleId: string;
  name: string;
  /** 0..1 similarity to the input. */
  score: number;
}

export interface Resolution {
  input: string;
  oracleId?: string;
  /** Canonical Scryfall name when resolved. */
  name?: string;
  method?: ResolveMethod;
  /** 0..1. Unresolved inputs have 0. */
  confidence: number;
  /** Ranked alternatives (populated for fuzzy/unresolved; empty for exact hits). */
  candidates: Candidate[];
}

/** Layouts that are never deck entries. Kept in the DB for display, excluded from resolution. */
export const NON_PLAYABLE_LAYOUTS: ReadonlySet<string> = new Set([
  "token",
  "double_faced_token",
  "emblem",
  "art_series",
  "vanguard",
  "scheme",
  "planar",
  "phenomenon",
]);

export interface ResolveOptions {
  /** Minimum Levenshtein similarity to auto-accept a fuzzy match. Default 0.85. */
  minFuzzy?: number;
  /** Max candidates returned. Default 5. */
  maxCandidates?: number;
}

interface Indexed extends NameIndexEntry {
  norm: string;
  loose: string;
  /** Loose keys of each face when the card has several (split/DFC/adventure); else empty. */
  faceLoose: string[];
}

export class NameIndex {
  private readonly entries: Indexed[] = [];
  private readonly byNorm = new Map<string, Indexed[]>();
  private readonly byLoose = new Map<string, Indexed[]>();
  private readonly byFaceNorm = new Map<string, Indexed[]>();
  private readonly byFaceLoose = new Map<string, Indexed[]>();
  private readonly trigrams = new Map<string, number[]>();

  constructor(entries: Iterable<NameIndexEntry>) {
    for (const e of entries) {
      if (NON_PLAYABLE_LAYOUTS.has(e.layout)) continue;
      const norm = normalizeCardName(e.name);
      const loose = looseCardKey(e.name);
      const faces = splitFaceNames(norm);
      const faceLoose = faces.length > 1 ? faces.map(looseCardKey) : [];
      const ix: Indexed = { ...e, norm, loose, faceLoose };
      const idx = this.entries.push(ix) - 1;
      push(this.byNorm, norm, ix);
      push(this.byLoose, loose, ix);
      if (faces.length > 1) {
        faces.forEach((f, i) => {
          push(this.byFaceNorm, f, ix);
          push(this.byFaceLoose, faceLoose[i], ix);
        });
      }
      for (const t of trigramsOf(loose)) push(this.trigrams, t, idx);
    }
  }

  get size(): number {
    return this.entries.length;
  }

  resolve(input: string, opts: ResolveOptions = {}): Resolution {
    const minFuzzy = opts.minFuzzy ?? 0.85;
    const maxCandidates = opts.maxCandidates ?? 5;
    const norm = normalizeCardName(input);
    if (!norm) return { input, confidence: 0, candidates: [] };

    const exact = this.byNorm.get(norm);
    if (exact?.length) return hit(input, exact[0], "exact", 1, []);

    const face = this.byFaceNorm.get(norm);
    if (face?.length) return hit(input, face[0], "face", 0.99, []);

    const loose = looseCardKey(input);
    const looseHit = this.byLoose.get(loose) ?? this.byFaceLoose.get(loose);
    if (looseHit?.length) return hit(input, looseHit[0], "normalized", 0.97, []);

    const candidates = this.fuzzyCandidates(loose, maxCandidates);
    const best = candidates[0];
    if (best && best.score >= minFuzzy) {
      const entry = this.entries.find((e) => e.oracleId === best.oracleId);
      if (entry) return hit(input, entry, "fuzzy", round2(best.score), candidates);
    }
    return { input, confidence: 0, candidates };
  }

  resolveMany(inputs: readonly string[], opts?: ResolveOptions): Resolution[] {
    return inputs.map((i) => this.resolve(i, opts));
  }

  private fuzzyCandidates(loose: string, max: number): Candidate[] {
    const counts = new Map<number, number>();
    for (const t of trigramsOf(loose)) {
      const hits = this.trigrams.get(t);
      if (!hits) continue;
      for (const idx of hits) counts.set(idx, (counts.get(idx) ?? 0) + 1);
    }
    // Shortlist by shared trigram count, then re-rank by edit similarity against the
    // full name and each face (so "Ulvenwald Captve" finds the transform card).
    const shortlist = [...counts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 40);
    const scored: Candidate[] = shortlist.map(([idx]) => {
      const e = this.entries[idx];
      let score = similarity(loose, e.loose);
      for (const f of e.faceLoose) score = Math.max(score, similarity(loose, f));
      return { oracleId: e.oracleId, name: e.name, score };
    });
    return scored.sort((a, b) => b.score - a.score).slice(0, max);
  }
}

function hit(input: string, e: Indexed, method: ResolveMethod, confidence: number, candidates: Candidate[]): Resolution {
  return { input, oracleId: e.oracleId, name: e.name, method, confidence, candidates };
}

function push<K, V>(map: Map<K, V[]>, key: K, value: V): void {
  const list = map.get(key);
  if (list) list.push(value);
  else map.set(key, [value]);
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

/** Trigrams over a padded string so short names still produce signal. */
export function trigramsOf(s: string): Set<string> {
  const padded = `  ${s} `;
  const out = new Set<string>();
  for (let i = 0; i + 3 <= padded.length; i++) out.add(padded.slice(i, i + 3));
  return out;
}

/** 1 − levenshtein / max(len). 1 for identical strings, 0 for fully different. */
export function similarity(a: string, b: string): number {
  if (a === b) return 1;
  const maxLen = Math.max(a.length, b.length);
  if (maxLen === 0) return 1;
  return 1 - levenshtein(a, b) / maxLen;
}

export function levenshtein(a: string, b: string): number {
  if (a.length < b.length) [a, b] = [b, a];
  if (b.length === 0) return a.length;
  let prev = new Array<number>(b.length + 1);
  let cur = new Array<number>(b.length + 1);
  for (let j = 0; j <= b.length; j++) prev[j] = j;
  for (let i = 1; i <= a.length; i++) {
    cur[0] = i;
    const ca = a.charCodeAt(i - 1);
    for (let j = 1; j <= b.length; j++) {
      const cost = ca === b.charCodeAt(j - 1) ? 0 : 1;
      cur[j] = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + cost);
    }
    [prev, cur] = [cur, prev];
  }
  return prev[b.length];
}
