//! Tauri commands = the whole Rust ⇄ frontend surface. Typed on the TS side in
//! `app/src/bridge/`. Long operations run on a blocking thread and stream `bulk-progress`
//! events (payload: `progress::Progress`).

use std::path::{Path, PathBuf};
use std::sync::Mutex;

use rusqlite::types::{Value as SqlValue, ValueRef};
use serde::{Deserialize, Serialize};
use tauri::{AppHandle, Emitter, Manager};

use crate::db;
use crate::download;
use crate::error::{msg, Error, Result};
use crate::import::{self, ImportReport, Part};
use crate::progress::{Progress, ProgressSink};

pub struct AppState {
    /// Bulk files + the SQLite DB. Local (non-roaming) app data: `%LOCALAPPDATA%\<identifier>`.
    pub data_dir: PathBuf,
    /// Re-creatable caches (images, Spellbook answers): `%LOCALAPPDATA%\<identifier>\cache`.
    pub cache_dir: PathBuf,
    pub db_path: PathBuf,
    pub import_lock: Mutex<()>,
}

impl AppState {
    /// `MAGICTRAINER_DATA_DIR` overrides the data location (dev: point at repo `data/`);
    /// `MAGICTRAINER_CACHE_DIR` overrides the cache location (defaults to `<data_dir>/cache`
    /// when the data dir is overridden, so a dev run never touches the real profile).
    pub fn from_app(app: &AppHandle) -> Result<Self> {
        let override_data = std::env::var_os("MAGICTRAINER_DATA_DIR").map(PathBuf::from);
        let data_dir = match &override_data {
            Some(p) => p.clone(),
            None => app.path().app_local_data_dir().map_err(|e| msg(e.to_string()))?,
        };
        let cache_dir = match std::env::var_os("MAGICTRAINER_CACHE_DIR") {
            Some(p) => PathBuf::from(p),
            None if override_data.is_some() => data_dir.join("cache"),
            None => app.path().app_cache_dir().map_err(|e| msg(e.to_string()))?.join("cache"),
        };
        std::fs::create_dir_all(&data_dir)?;
        std::fs::create_dir_all(&cache_dir)?;
        Ok(Self { db_path: data_dir.join("magictrainer.sqlite"), data_dir, cache_dir, import_lock: Mutex::new(()) })
    }
}

struct EventSink(AppHandle);
impl ProgressSink for EventSink {
    fn report(&self, p: Progress) {
        let _ = self.0.emit("bulk-progress", &p);
    }
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct DbStatus {
    pub db_path: String,
    pub data_dir: String,
    pub cache_dir: String,
    pub exists: bool,
    pub schema_version: Option<String>,
    pub counts: std::collections::BTreeMap<String, i64>,
    pub meta: std::collections::BTreeMap<String, String>,
}

/// Runs on the blocking pool: sync commands execute on the main thread and would stall the
/// window while a big query (e.g. the 38k-row name index) serializes.
#[tauri::command]
pub async fn db_status(app: AppHandle) -> Result<DbStatus> {
    tauri::async_runtime::spawn_blocking(move || db_status_blocking(&app.state::<AppState>()))
        .await
        .map_err(|e| msg(format!("task panicked: {e}")))?
}

fn db_status_blocking(state: &AppState) -> Result<DbStatus> {
    let mut status = DbStatus {
        db_path: state.db_path.display().to_string(),
        data_dir: state.data_dir.display().to_string(),
        cache_dir: state.cache_dir.display().to_string(),
        exists: state.db_path.is_file(),
        schema_version: None,
        counts: Default::default(),
        meta: Default::default(),
    };
    if !status.exists {
        return Ok(status);
    }
    let conn = db::open_ro(&state.db_path)?;
    status.schema_version = db::meta_get(&conn, "schema_version")?;
    for table in ["cards", "printings", "rulings", "oracle_tags", "card_oracle_tags", "spellbook_variants"] {
        status.counts.insert(table.into(), db::count(&conn, table)?);
    }
    let mut stmt = conn.prepare("SELECT key, value FROM meta ORDER BY key")?;
    let rows = stmt.query_map([], |r| Ok((r.get::<_, String>(0)?, r.get::<_, String>(1)?)))?;
    for row in rows {
        let (k, v) = row?;
        status.meta.insert(k, v);
    }
    Ok(status)
}

fn to_sql(v: &serde_json::Value) -> Result<SqlValue> {
    Ok(match v {
        serde_json::Value::Null => SqlValue::Null,
        serde_json::Value::Bool(b) => SqlValue::Integer(*b as i64),
        serde_json::Value::Number(n) => {
            if let Some(i) = n.as_i64() {
                SqlValue::Integer(i)
            } else {
                SqlValue::Real(n.as_f64().unwrap_or(0.0))
            }
        }
        serde_json::Value::String(s) => SqlValue::Text(s.clone()),
        other => SqlValue::Text(other.to_string()),
    })
}

fn from_sql(v: ValueRef<'_>) -> serde_json::Value {
    match v {
        ValueRef::Null => serde_json::Value::Null,
        ValueRef::Integer(i) => serde_json::Value::from(i),
        ValueRef::Real(f) => serde_json::Value::from(f),
        ValueRef::Text(t) => serde_json::Value::String(String::from_utf8_lossy(t).into_owned()),
        ValueRef::Blob(b) => serde_json::Value::String(format!("<blob {} bytes>", b.len())),
    }
}

/// Read-only SQL for the data layer. The connection is opened read-only and `query_only`,
/// so a mistaken UPDATE fails instead of mutating the card DB.
#[tauri::command]
pub async fn db_query(
    app: AppHandle,
    sql: String,
    params: Option<Vec<serde_json::Value>>,
) -> Result<Vec<serde_json::Map<String, serde_json::Value>>> {
    let db_path = app.state::<AppState>().db_path.clone();
    tauri::async_runtime::spawn_blocking(move || db_query_blocking(&db_path, &sql, params))
        .await
        .map_err(|e| msg(format!("task panicked: {e}")))?
}

fn db_query_blocking(db_path: &Path, sql: &str, params: Option<Vec<serde_json::Value>>) -> Result<Vec<serde_json::Map<String, serde_json::Value>>> {
    let head = sql.trim_start().to_ascii_lowercase();
    if !(head.starts_with("select") || head.starts_with("with") || head.starts_with("pragma table_info")) {
        return Err(msg("db_query accepts SELECT / WITH statements only"));
    }
    let conn = db::open_ro(db_path)?;
    let mut stmt = conn.prepare_cached(sql)?;
    let names: Vec<String> = stmt.column_names().iter().map(|s| s.to_string()).collect();
    let params: Vec<SqlValue> = params.unwrap_or_default().iter().map(to_sql).collect::<Result<_>>()?;
    let mut rows = stmt.query(rusqlite::params_from_iter(params.iter()))?;
    let mut out = Vec::new();
    while let Some(row) = rows.next()? {
        let mut obj = serde_json::Map::with_capacity(names.len());
        for (i, name) in names.iter().enumerate() {
            obj.insert(name.clone(), from_sql(row.get_ref(i)?));
        }
        out.push(obj);
    }
    Ok(out)
}

#[derive(Debug, Deserialize)]
#[serde(tag = "kind", rename_all = "snake_case")]
pub enum ImportSource {
    /// Files already on disk (default: the app data dir; dev: repo `data/`).
    Dir { dir: Option<String> },
    /// Download into the data dir first, then import.
    Download,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct BulkImportResult {
    pub downloaded: Vec<download::Downloaded>,
    pub report: ImportReport,
    pub seconds: f64,
}

/// Download (optionally) and import bulk data. `parts` defaults to everything.
#[tauri::command]
pub async fn import_bulk(
    app: AppHandle,
    source: ImportSource,
    parts: Option<Vec<Part>>,
) -> Result<BulkImportResult> {
    let state = app.state::<AppState>();
    let data_dir = state.data_dir.clone();
    let db_path = state.db_path.clone();
    let parts = parts.unwrap_or_else(|| Part::ALL.to_vec());
    let app2 = app.clone();
    tauri::async_runtime::spawn_blocking(move || {
        let state = app2.state::<AppState>();
        let _guard = state.import_lock.try_lock().map_err(|_| msg("an import is already running"))?;
        let started = std::time::Instant::now();
        let sink = EventSink(app2.clone());
        let (dir, downloaded) = match source {
            ImportSource::Dir { dir } => (dir.map(PathBuf::from).unwrap_or(data_dir), Vec::new()),
            ImportSource::Download => {
                let d = download::download_parts(&data_dir, &parts, &sink)?;
                (data_dir, d)
            }
        };
        let report = import::import_dir(&dir, &db_path, &parts, &sink)?;
        Ok::<_, Error>(BulkImportResult { downloaded, report, seconds: started.elapsed().as_secs_f64() })
    })
    .await
    .map_err(|e| msg(format!("import task panicked: {e}")))?
}

/// Scryfall bulk index (types, sizes, updated_at) so the UI can show what an update would fetch.
#[tauri::command]
pub async fn scryfall_bulk_index() -> Result<Vec<download::BulkEntry>> {
    tauri::async_runtime::spawn_blocking(download::list_scryfall_bulk)
        .await
        .map_err(|e| msg(format!("task panicked: {e}")))?
}
