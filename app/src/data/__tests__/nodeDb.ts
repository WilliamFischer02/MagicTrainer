import { existsSync } from "node:fs";
import { join } from "node:path";
import { DatabaseSync } from "node:sqlite";
import type { DbClient, Row, SqlParam } from "../db";

/**
 * Test-only `DbClient` over Node's built-in SQLite, pointed at the real imported DB
 * (`data/magictrainer.sqlite`, produced by `cargo run --bin magictrainer-import`). The SQL in
 * `src/data` runs unchanged here and inside Tauri (D-009). Never imported by app code.
 */
export class NodeDb implements DbClient {
  private readonly db: DatabaseSync;
  constructor(path: string) {
    this.db = new DatabaseSync(path, { readOnly: true });
  }
  async query<T extends Row = Row>(sql: string, params: readonly SqlParam[] = []): Promise<T[]> {
    const bound = params.map((p) => (typeof p === "boolean" ? Number(p) : p));
    const rows = this.db.prepare(sql).all(...bound) as unknown as T[];
    // node:sqlite rows have a null prototype; copy so Zod/JSON behave normally.
    return rows.map((r) => ({ ...r }));
  }
  close(): void {
    this.db.close();
  }
}

/** Repo `data/magictrainer.sqlite`, or undefined when no import has been run on this machine. */
export function localDbPath(): string | undefined {
  const p = process.env.MAGICTRAINER_DB ?? join(__dirname, "../../../../data/magictrainer.sqlite");
  return existsSync(p) ? p : undefined;
}
