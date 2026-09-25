//! Collection persistence (ManaBox / TCGplayer / Moxfield CSV rows → `collection` table).
//! Read-only import: ManaBox stays the source of truth (Q-008); reads live in `src/data/collection.ts`.

use std::path::Path;

use rusqlite::params;
use serde::{Deserialize, Serialize};
use tauri::{AppHandle, Manager};

use crate::commands::AppState;
use crate::db;
use crate::error::{msg, Result};

#[derive(Debug, Clone, Serialize, Deserialize, Default)]
#[serde(rename_all = "camelCase")]
pub struct CollectionRowInput {
    #[serde(default)]
    pub printing_id: Option<String>,
    #[serde(default)]
    pub oracle_id: Option<String>,
    pub name: String,
    #[serde(default)]
    pub set_code: Option<String>,
    #[serde(default)]
    pub collector_number: Option<String>,
    pub quantity: i64,
    #[serde(default)]
    pub foil: bool,
    #[serde(default)]
    pub condition: Option<String>,
    #[serde(default)]
    pub language: Option<String>,
    /// Original CSV row (JSON object) for round-tripping / debugging.
    #[serde(default = "empty_obj")]
    pub raw_json: String,
}

fn empty_obj() -> String {
    "{}".into()
}

#[derive(Debug, Clone, Copy, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "snake_case")]
pub enum ImportMode {
    /// Delete the existing collection first (ManaBox full exports).
    Replace,
    /// Keep existing rows and add these.
    Append,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct CollectionImported {
    pub inserted: usize,
    pub total_rows: i64,
    pub total_cards: i64,
    pub imported_at: String,
}

fn validate(rows: &[CollectionRowInput], source_format: &str) -> Result<()> {
    if rows.is_empty() {
        return Err(msg("no collection rows to import"));
    }
    if rows.len() > 200_000 {
        return Err(msg("collection import is capped at 200,000 rows"));
    }
    if source_format.trim().is_empty() || source_format.len() > 32 {
        return Err(msg("source format is required"));
    }
    for r in rows {
        if r.name.trim().is_empty() {
            return Err(msg("a collection row has an empty name"));
        }
        if !(1..=9999).contains(&r.quantity) {
            return Err(msg(format!("{}: quantity {} is out of range", r.name, r.quantity)));
        }
    }
    Ok(())
}

pub fn import_rows(db_path: &Path, rows: &[CollectionRowInput], source_format: &str, mode: ImportMode) -> Result<CollectionImported> {
    validate(rows, source_format)?;
    let mut conn = db::open_rw(db_path)?;
    let now = db::now_iso();
    let tx = conn.transaction()?;
    if mode == ImportMode::Replace {
        tx.execute("DELETE FROM collection", [])?;
    }
    let mut ins = tx.prepare_cached(
        "INSERT INTO collection (printing_id, oracle_id, name, set_code, collector_number, quantity, foil, condition, language, source_format, raw_json, imported_at)
         VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12)",
    )?;
    let mut inserted = 0usize;
    for r in rows {
        ins.execute(params![
            r.printing_id,
            r.oracle_id,
            r.name.trim(),
            r.set_code.as_deref().map(|s| s.to_ascii_lowercase()),
            r.collector_number,
            r.quantity,
            r.foil as i64,
            r.condition,
            r.language,
            source_format,
            r.raw_json,
            now,
        ])?;
        inserted += 1;
    }
    drop(ins);
    tx.commit()?;
    db::meta_set(&conn, "collection.imported_at", &now)?;
    db::meta_set(&conn, "collection.source_format", source_format)?;
    let (total_rows, total_cards): (i64, i64) =
        conn.query_row("SELECT COUNT(*), COALESCE(SUM(quantity), 0) FROM collection", [], |r| Ok((r.get(0)?, r.get(1)?)))?;
    Ok(CollectionImported { inserted, total_rows, total_cards, imported_at: now })
}

pub fn clear(db_path: &Path) -> Result<i64> {
    let conn = db::open_rw(db_path)?;
    let n = conn.execute("DELETE FROM collection", [])? as i64;
    conn.execute("DELETE FROM meta WHERE key IN ('collection.imported_at', 'collection.source_format')", [])?;
    Ok(n)
}

#[tauri::command]
pub async fn collection_import(app: AppHandle, rows: Vec<CollectionRowInput>, source_format: String, mode: Option<ImportMode>) -> Result<CollectionImported> {
    let db_path = app.state::<AppState>().db_path.clone();
    tauri::async_runtime::spawn_blocking(move || import_rows(&db_path, &rows, &source_format, mode.unwrap_or(ImportMode::Replace)))
        .await
        .map_err(|e| msg(format!("task panicked: {e}")))?
}

#[tauri::command]
pub async fn collection_clear(app: AppHandle) -> Result<i64> {
    let db_path = app.state::<AppState>().db_path.clone();
    tauri::async_runtime::spawn_blocking(move || clear(&db_path))
        .await
        .map_err(|e| msg(format!("task panicked: {e}")))?
}

#[cfg(test)]
mod tests {
    use super::*;

    fn row(name: &str, q: i64) -> CollectionRowInput {
        CollectionRowInput { name: name.into(), quantity: q, set_code: Some("C21".into()), ..Default::default() }
    }

    #[test]
    fn replace_then_append_then_clear() {
        let dir = std::env::temp_dir().join(format!("mt-coll-{}", std::process::id()));
        std::fs::create_dir_all(&dir).unwrap();
        let db_path = dir.join("c.sqlite");
        let _ = std::fs::remove_file(&db_path);
        let a = import_rows(&db_path, &[row("Sol Ring", 1), row("Swamp", 20)], "manabox-csv", ImportMode::Replace).unwrap();
        assert_eq!((a.inserted, a.total_rows, a.total_cards), (2, 2, 21));
        let b = import_rows(&db_path, &[row("Sol Ring", 1)], "manabox-csv", ImportMode::Append).unwrap();
        assert_eq!((b.inserted, b.total_rows, b.total_cards), (1, 3, 22));
        let c = import_rows(&db_path, &[row("Island", 4)], "tcgplayer-csv", ImportMode::Replace).unwrap();
        assert_eq!((c.total_rows, c.total_cards), (1, 4));
        let conn = db::open_ro(&db_path).unwrap();
        let set: String = conn.query_row("SELECT set_code FROM collection", [], |r| r.get(0)).unwrap();
        assert_eq!(set, "c21");
        assert_eq!(db::meta_get(&conn, "collection.source_format").unwrap().as_deref(), Some("tcgplayer-csv"));
        drop(conn);
        assert_eq!(clear(&db_path).unwrap(), 1);
        let _ = std::fs::remove_dir_all(&dir);
    }

    #[test]
    fn validation() {
        let db_path = std::env::temp_dir().join("mt-coll-bad.sqlite");
        assert!(import_rows(&db_path, &[], "manabox-csv", ImportMode::Replace).is_err());
        assert!(import_rows(&db_path, &[row("", 1)], "manabox-csv", ImportMode::Replace).is_err());
        assert!(import_rows(&db_path, &[row("X", 0)], "manabox-csv", ImportMode::Replace).is_err());
        assert!(import_rows(&db_path, &[row("X", 1)], "", ImportMode::Replace).is_err());
    }
}
