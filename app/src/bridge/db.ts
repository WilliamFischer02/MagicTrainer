import { invoke } from "@tauri-apps/api/core";
import type { DbClient, Row, SqlParam } from "../data/db";

/** `DbClient` over the Rust `db_query` command (read-only connection, D-009). */
export class TauriDb implements DbClient {
  async query<T extends Row = Row>(sql: string, params: readonly SqlParam[] = []): Promise<T[]> {
    return invoke<T[]>("db_query", { sql, params: [...params] });
  }
}

export const tauriDb: DbClient = new TauriDb();
