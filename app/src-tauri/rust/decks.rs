//! Deck persistence + import-file reading. Writes go through here (D-009: the frontend only
//! reads via `db_query`); reads live in `src/data/decks.ts`.
//!
//! `read_import_file` exists because Tauri's drag-drop hands the webview *paths*, not file
//! contents, and the dialog plugin returns a path too. It only reads small text files with
//! decklist/CSV extensions, so a stray path can never pull in a binary or a huge file.

use std::path::{Path, PathBuf};

use rusqlite::params;
use serde::{Deserialize, Serialize};
use tauri::{AppHandle, Manager};

use crate::commands::AppState;
use crate::db;
use crate::error::{msg, Result};

pub const MAX_IMPORT_BYTES: u64 = 8 * 1024 * 1024;
const IMPORT_EXTENSIONS: [&str; 6] = ["txt", "csv", "dec", "dek", "mwdeck", "cod"];

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ImportFile {
    pub path: String,
    /// File name without directory, e.g. `athreos-aristocrats.txt`.
    pub file_name: String,
    /// File stem, e.g. `athreos-aristocrats` — the default deck name.
    pub stem: String,
    pub extension: String,
    pub bytes: u64,
    pub text: String,
}

pub fn read_import_path(path: &Path) -> Result<ImportFile> {
    let ext = path.extension().and_then(|e| e.to_str()).map(|e| e.to_ascii_lowercase()).unwrap_or_default();
    if !IMPORT_EXTENSIONS.contains(&ext.as_str()) {
        return Err(msg(format!(
            "{} is not a decklist or CSV file (expected .{})",
            path.display(),
            IMPORT_EXTENSIONS.join(", .")
        )));
    }
    let meta = std::fs::metadata(path)?;
    if !meta.is_file() {
        return Err(msg(format!("{} is not a file", path.display())));
    }
    if meta.len() > MAX_IMPORT_BYTES {
        return Err(msg(format!("{} is {:.1} MB; import files are capped at {} MB", path.display(), meta.len() as f64 / 1e6, MAX_IMPORT_BYTES / (1024 * 1024))));
    }
    let bytes = std::fs::read(path)?;
    let text = decode_text(&bytes);
    Ok(ImportFile {
        path: path.display().to_string(),
        file_name: path.file_name().and_then(|s| s.to_str()).unwrap_or("").to_string(),
        stem: path.file_stem().and_then(|s| s.to_str()).unwrap_or("deck").to_string(),
        extension: ext,
        bytes: meta.len(),
        text,
    })
}

/// UTF-8 (with or without BOM), else UTF-16 LE/BOM (Excel "Unicode text"), else lossy UTF-8.
fn decode_text(bytes: &[u8]) -> String {
    if let Some(rest) = bytes.strip_prefix(&[0xEF, 0xBB, 0xBF]) {
        return String::from_utf8_lossy(rest).into_owned();
    }
    if let Some(rest) = bytes.strip_prefix(&[0xFF, 0xFE]) {
        let units: Vec<u16> = rest.chunks_exact(2).map(|c| u16::from_le_bytes([c[0], c[1]])).collect();
        return String::from_utf16_lossy(&units);
    }
    String::from_utf8_lossy(bytes).into_owned()
}

#[tauri::command]
pub async fn read_import_file(path: String) -> Result<ImportFile> {
    tauri::async_runtime::spawn_blocking(move || read_import_path(&PathBuf::from(path)))
        .await
        .map_err(|e| msg(format!("task panicked: {e}")))?
}

// ---- deck persistence -----------------------------------------------------------------

#[derive(Debug, Clone, Serialize, Deserialize, Default)]
#[serde(rename_all = "camelCase")]
pub struct DeckEntryInput {
    pub name: String,
    pub quantity: i64,
    #[serde(default)]
    pub set_code: Option<String>,
    #[serde(default)]
    pub collector_number: Option<String>,
    #[serde(default)]
    pub oracle_id: Option<String>,
}

/// Mirrors `core/types.ts::Deck` (camelCase over IPC).
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct DeckInput {
    pub id: String,
    pub name: String,
    #[serde(default)]
    pub format: Option<String>,
    #[serde(default)]
    pub commanders: Vec<DeckEntryInput>,
    #[serde(default)]
    pub main: Vec<DeckEntryInput>,
    #[serde(default)]
    pub sideboard: Vec<DeckEntryInput>,
    #[serde(default)]
    pub extra: std::collections::BTreeMap<String, Vec<DeckEntryInput>>,
    pub source: DeckSource,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DeckSource {
    pub format: String,
    pub raw: String,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct DeckSaved {
    pub id: String,
    pub entries: usize,
    pub created: bool,
    pub updated_at: String,
}

fn validate(deck: &DeckInput) -> Result<()> {
    if deck.id.trim().is_empty() || deck.id.len() > 64 {
        return Err(msg("deck id must be 1–64 characters"));
    }
    if deck.name.trim().is_empty() {
        return Err(msg("deck name is required"));
    }
    if deck.name.chars().count() > 120 {
        return Err(msg("deck name is too long (max 120 characters)"));
    }
    let all = deck.commanders.iter().chain(&deck.main).chain(&deck.sideboard).chain(deck.extra.values().flatten());
    let mut n = 0usize;
    for e in all {
        n += 1;
        if e.name.trim().is_empty() {
            return Err(msg("a deck entry has an empty name"));
        }
        if !(1..=999).contains(&e.quantity) {
            return Err(msg(format!("{}: quantity {} is out of range", e.name, e.quantity)));
        }
    }
    if n == 0 {
        return Err(msg("deck has no cards"));
    }
    if n > 2000 {
        return Err(msg("deck has too many distinct entries"));
    }
    for k in deck.extra.keys() {
        if k.is_empty() || k.len() > 32 || ["commanders", "main", "sideboard"].contains(&k.as_str()) {
            return Err(msg(format!("invalid extra section name {k:?}")));
        }
    }
    Ok(())
}

/// Insert or replace a deck and all of its entries in one transaction.
pub fn save_deck(db_path: &Path, deck: &DeckInput) -> Result<DeckSaved> {
    validate(deck)?;
    let mut conn = db::open_rw(db_path)?;
    let now = db::now_iso();
    let tx = conn.transaction()?;
    let existing: Option<String> = tx
        .query_row("SELECT created_at FROM decks WHERE id = ?1", [&deck.id], |r| r.get(0))
        .ok();
    let created_at = existing.clone().unwrap_or_else(|| now.clone());
    tx.execute(
        "INSERT INTO decks (id, name, format, source_format, raw, created_at, updated_at)
         VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7)
         ON CONFLICT(id) DO UPDATE SET name = excluded.name, format = excluded.format,
           source_format = excluded.source_format, raw = excluded.raw, updated_at = excluded.updated_at",
        params![deck.id, deck.name.trim(), deck.format, deck.source.format, deck.source.raw, created_at, now],
    )?;
    tx.execute("DELETE FROM deck_entries WHERE deck_id = ?1", [&deck.id])?;
    let mut ins = tx.prepare_cached(
        "INSERT INTO deck_entries (deck_id, section, position, name, quantity, set_code, collector_number, oracle_id)
         VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8)",
    )?;
    let mut n = 0usize;
    let mut write = |section: &str, entries: &[DeckEntryInput]| -> Result<()> {
        for (i, e) in entries.iter().enumerate() {
            ins.execute(params![deck.id, section, i as i64, e.name.trim(), e.quantity, e.set_code, e.collector_number, e.oracle_id])?;
            n += 1;
        }
        Ok(())
    };
    write("commanders", &deck.commanders)?;
    write("main", &deck.main)?;
    write("sideboard", &deck.sideboard)?;
    for (k, v) in &deck.extra {
        write(&format!("extra:{k}"), v)?;
    }
    drop(ins);
    tx.commit()?;
    Ok(DeckSaved { id: deck.id.clone(), entries: n, created: existing.is_none(), updated_at: now })
}

pub fn delete_deck(db_path: &Path, id: &str) -> Result<bool> {
    let conn = db::open_rw(db_path)?;
    conn.execute("DELETE FROM deck_entries WHERE deck_id = ?1", [id])?;
    let n = conn.execute("DELETE FROM decks WHERE id = ?1", [id])?;
    Ok(n > 0)
}

#[tauri::command]
pub async fn deck_save(app: AppHandle, deck: DeckInput) -> Result<DeckSaved> {
    let db_path = app.state::<AppState>().db_path.clone();
    tauri::async_runtime::spawn_blocking(move || save_deck(&db_path, &deck))
        .await
        .map_err(|e| msg(format!("task panicked: {e}")))?
}

#[tauri::command]
pub async fn deck_delete(app: AppHandle, id: String) -> Result<bool> {
    let db_path = app.state::<AppState>().db_path.clone();
    tauri::async_runtime::spawn_blocking(move || delete_deck(&db_path, &id))
        .await
        .map_err(|e| msg(format!("task panicked: {e}")))?
}

#[cfg(test)]
mod tests {
    use super::*;

    fn tmp(name: &str) -> PathBuf {
        let dir = std::env::temp_dir().join(format!("mt-decks-{}", std::process::id()));
        std::fs::create_dir_all(&dir).unwrap();
        dir.join(name)
    }

    fn entry(name: &str, q: i64) -> DeckEntryInput {
        DeckEntryInput { name: name.into(), quantity: q, ..Default::default() }
    }

    fn deck() -> DeckInput {
        DeckInput {
            id: "d1".into(),
            name: "Athreos".into(),
            format: Some("commander".into()),
            commanders: vec![entry("Athreos, God of Passage", 1)],
            main: vec![entry("Blood Artist", 1), entry("Swamp", 30)],
            sideboard: vec![],
            extra: [("maybeboard".to_string(), vec![entry("Sol Ring", 1)])].into_iter().collect(),
            source: DeckSource { format: "decklist-text".into(), raw: "1 Blood Artist".into() },
        }
    }

    #[test]
    fn reads_utf8_bom_and_utf16() {
        let p = tmp("bom.txt");
        std::fs::write(&p, [0xEF, 0xBB, 0xBF, b'1', b' ', b'X']).unwrap();
        assert_eq!(read_import_path(&p).unwrap().text, "1 X");
        let p16 = tmp("u16.csv");
        let mut b = vec![0xFF, 0xFE];
        for u in "a,b".encode_utf16() {
            b.extend_from_slice(&u.to_le_bytes());
        }
        std::fs::write(&p16, b).unwrap();
        let f = read_import_path(&p16).unwrap();
        assert_eq!(f.text, "a,b");
        assert_eq!(f.stem, "u16");
        assert_eq!(f.extension, "csv");
    }

    #[test]
    fn refuses_wrong_extension_and_missing_file() {
        let p = tmp("x.exe");
        std::fs::write(&p, b"MZ").unwrap();
        assert!(read_import_path(&p).is_err());
        assert!(read_import_path(&tmp("missing.txt")).is_err());
    }

    #[test]
    fn saves_replaces_and_deletes_a_deck() {
        let db_path = tmp("decks.sqlite");
        let _ = std::fs::remove_file(&db_path);
        let d = deck();
        let saved = save_deck(&db_path, &d).unwrap();
        assert!(saved.created);
        assert_eq!(saved.entries, 4);

        let mut d2 = d.clone();
        d2.name = "Athreos v2".into();
        d2.main.push(entry("Zulaport Cutthroat", 1));
        let saved2 = save_deck(&db_path, &d2).unwrap();
        assert!(!saved2.created);
        assert_eq!(saved2.entries, 5);

        let conn = db::open_ro(&db_path).unwrap();
        let (name, n): (String, i64) = conn
            .query_row("SELECT d.name, (SELECT COUNT(*) FROM deck_entries e WHERE e.deck_id = d.id) FROM decks d WHERE d.id = 'd1'", [], |r| Ok((r.get(0)?, r.get(1)?)))
            .unwrap();
        assert_eq!((name.as_str(), n), ("Athreos v2", 5));
        let sections: Vec<String> = conn
            .prepare("SELECT DISTINCT section FROM deck_entries WHERE deck_id = 'd1' ORDER BY section")
            .unwrap()
            .query_map([], |r| r.get(0))
            .unwrap()
            .collect::<std::result::Result<_, _>>()
            .unwrap();
        assert_eq!(sections, vec!["commanders", "extra:maybeboard", "main"]);
        drop(conn);

        assert!(delete_deck(&db_path, "d1").unwrap());
        assert!(!delete_deck(&db_path, "d1").unwrap());
    }

    #[test]
    fn validation_rejects_bad_input() {
        let db_path = tmp("decks-bad.sqlite");
        let mut d = deck();
        d.name = "  ".into();
        assert!(save_deck(&db_path, &d).is_err());
        let mut d = deck();
        d.main[0].quantity = 0;
        assert!(save_deck(&db_path, &d).is_err());
        let mut d = deck();
        d.commanders.clear();
        d.main.clear();
        d.extra.clear();
        assert!(save_deck(&db_path, &d).is_err());
        let mut d = deck();
        d.extra.insert("main".into(), vec![entry("X", 1)]);
        assert!(save_deck(&db_path, &d).is_err());
    }
}
