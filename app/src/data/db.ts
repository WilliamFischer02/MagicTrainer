/**
 * The one seam between the data layer and a SQLite connection (D-009).
 * `src/bridge/db.ts` implements it over Tauri's `db_query`; tests implement it over
 * Node's built-in `node:sqlite` against the same file. SQL lives here in `src/data`,
 * never in the bridge.
 *
 * `data/` depends on `core/` only. No React, no Tauri.
 */

export type SqlParam = string | number | boolean | null;
export type Row = Record<string, unknown>;

export interface DbClient {
  /** Run a read-only SELECT/WITH statement and return plain row objects. */
  query<T extends Row = Row>(sql: string, params?: readonly SqlParam[]): Promise<T[]>;
}

/** `?1, ?2, …` placeholder list for IN (...) clauses. */
export function placeholders(count: number, offset = 0): string {
  return Array.from({ length: count }, (_, i) => `?${i + 1 + offset}`).join(", ");
}

/** Split `items` into chunks so a query never exceeds SQLite's bound-parameter limit. */
export function chunk<T>(items: readonly T[], size = 500): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < items.length; i += size) out.push(items.slice(i, i + size));
  return out;
}
