//! Bulk importers. Every importer streams its source (gzip → line/element at a time),
//! never loads a whole file, reports progress through a `ProgressSink`, and records the
//! source file's timestamp in `meta` so the UI can show "data as of …".

pub mod scryfall;
pub mod spellbook;

use std::fs::File;
use std::io::{self, BufRead, BufReader, Read};
use std::path::Path;
use std::sync::atomic::{AtomicU64, Ordering};
use std::sync::Arc;

use flate2::read::MultiGzDecoder;
use rusqlite::Connection;

use crate::db;
use crate::error::Result;
use crate::progress::ProgressSink;

/// Which datasets to (re)import. Missing files are skipped and reported, never fatal.
#[derive(Debug, Clone, Copy, PartialEq, Eq, serde::Serialize, serde::Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum Part {
    OracleCards,
    Printings,
    Rulings,
    OracleTags,
    Spellbook,
}

impl Part {
    pub const ALL: [Part; 5] = [Part::OracleCards, Part::Printings, Part::Rulings, Part::OracleTags, Part::Spellbook];

    /// File name inside the data directory (matches `scripts/fetch-data.ps1`).
    pub fn file_name(self) -> &'static str {
        match self {
            Part::OracleCards => "scryfall/oracle_cards.jsonl.gz",
            Part::Printings => "scryfall/default_cards.jsonl.gz",
            Part::Rulings => "scryfall/rulings.jsonl.gz",
            Part::OracleTags => "scryfall/oracle_tags.jsonl.gz",
            Part::Spellbook => "spellbook/variants.json.gz",
        }
    }

    /// Scryfall bulk-data `type`, when the part comes from Scryfall.
    pub fn scryfall_type(self) -> Option<&'static str> {
        match self {
            Part::OracleCards => Some("oracle_cards"),
            Part::Printings => Some("default_cards"),
            Part::Rulings => Some("rulings"),
            Part::OracleTags => Some("oracle_tags"),
            Part::Spellbook => None,
        }
    }

    pub fn meta_key(self) -> &'static str {
        match self {
            Part::OracleCards => "imported.oracle_cards",
            Part::Printings => "imported.printings",
            Part::Rulings => "imported.rulings",
            Part::OracleTags => "imported.oracle_tags",
            Part::Spellbook => "imported.spellbook",
        }
    }
}

#[derive(Debug, Clone, Default, serde::Serialize)]
#[serde(rename_all = "camelCase")]
pub struct PartReport {
    pub part: String,
    pub file: String,
    pub skipped: Option<String>,
    pub rows: u64,
    pub ignored: u64,
    pub seconds: f64,
}

#[derive(Debug, Clone, Default, serde::Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ImportReport {
    pub parts: Vec<PartReport>,
    pub counts: std::collections::BTreeMap<String, i64>,
}

/// Import the requested parts from files under `data_dir` into the DB at `db_path`.
pub fn import_dir(data_dir: &Path, db_path: &Path, parts: &[Part], sink: &dyn ProgressSink) -> Result<ImportReport> {
    let mut conn = db::open_rw(db_path)?;
    let mut report = ImportReport::default();
    for &part in parts {
        let file = data_dir.join(part.file_name());
        let started = std::time::Instant::now();
        let mut pr = PartReport { part: format!("{part:?}"), file: file.display().to_string(), ..Default::default() };
        if !file.is_file() {
            pr.skipped = Some("file not found".into());
            report.parts.push(pr);
            continue;
        }
        let stats = match part {
            Part::OracleCards => scryfall::import_oracle_cards(&mut conn, &file, sink)?,
            Part::Printings => scryfall::import_printings(&mut conn, &file, sink)?,
            Part::Rulings => scryfall::import_rulings(&mut conn, &file, sink)?,
            Part::OracleTags => scryfall::import_oracle_tags(&mut conn, &file, sink)?,
            Part::Spellbook => spellbook::import_variants(&mut conn, &file, sink)?,
        };
        pr.rows = stats.rows;
        pr.ignored = stats.ignored;
        pr.seconds = started.elapsed().as_secs_f64();
        db::meta_set(&conn, part.meta_key(), &db::now_iso())?;
        if let Ok(modified) = std::fs::metadata(&file).and_then(|m| m.modified()) {
            if let Ok(d) = modified.duration_since(std::time::UNIX_EPOCH) {
                db::meta_set(&conn, &format!("{}.source_mtime", part.meta_key()), &d.as_secs().to_string())?;
            }
        }
        report.parts.push(pr);
    }
    for table in ["cards", "printings", "rulings", "oracle_tags", "card_oracle_tags", "spellbook_variants"] {
        report.counts.insert(table.to_string(), db::count(&conn, table)?);
    }
    Ok(report)
}

#[derive(Debug, Default, Clone, Copy)]
pub struct Stats {
    pub rows: u64,
    pub ignored: u64,
}

/// Counts compressed bytes as they are read so progress can be reported against file size.
pub struct CountingReader<R: Read> {
    inner: R,
    pub read: Arc<AtomicU64>,
}

impl<R: Read> Read for CountingReader<R> {
    fn read(&mut self, buf: &mut [u8]) -> io::Result<usize> {
        let n = self.inner.read(buf)?;
        self.read.fetch_add(n as u64, Ordering::Relaxed);
        Ok(n)
    }
}

/// Open a bulk file as a buffered line reader plus (bytes read, total bytes). Gzip is
/// detected by magic bytes, so a file that a downloader already inflated (PowerShell's
/// `Invoke-WebRequest` honours `Content-Encoding: gzip` and writes plain JSON under a `.gz`
/// name) still imports.
pub fn open_gz_lines(path: &Path) -> Result<(Box<dyn BufRead + Send>, Arc<AtomicU64>, u64)> {
    let (reader, read, total) = open_gz_reader(path)?;
    Ok((Box::new(BufReader::with_capacity(1 << 20, reader)), read, total))
}

/// Raw byte reader over a possibly-gzipped file (for serde streaming of one big JSON document).
pub fn open_gz_reader(path: &Path) -> Result<(Box<dyn Read + Send>, Arc<AtomicU64>, u64)> {
    let file = File::open(path)?;
    let total = file.metadata()?.len();
    let read = Arc::new(AtomicU64::new(0));
    let mut buffered = BufReader::with_capacity(1 << 20, file);
    let is_gzip = matches!(buffered.fill_buf()?, [0x1f, 0x8b, ..]);
    let counting = CountingReader { inner: buffered, read: read.clone() };
    if is_gzip {
        Ok((Box::new(MultiGzDecoder::new(counting)), read, total))
    } else {
        Ok((Box::new(counting), read, total))
    }
}

pub(crate) fn json_or_empty_array<T: serde::Serialize>(v: &[T]) -> String {
    serde_json::to_string(v).unwrap_or_else(|_| "[]".to_string())
}

pub(crate) fn opt_json(v: &Option<serde_json::Value>) -> Option<String> {
    v.as_ref().and_then(|x| if x.is_null() { None } else { serde_json::to_string(x).ok() })
}

/// Run `f` inside one write transaction with import-friendly pragmas, restoring them after.
pub(crate) fn with_bulk_tx<T>(conn: &mut Connection, f: impl FnOnce(&rusqlite::Transaction) -> Result<T>) -> Result<T> {
    conn.execute_batch("PRAGMA synchronous = OFF;")?;
    let tx = conn.transaction()?;
    let out = f(&tx);
    match out {
        Ok(v) => {
            tx.commit()?;
            conn.execute_batch("PRAGMA synchronous = NORMAL;")?;
            Ok(v)
        }
        Err(e) => {
            drop(tx);
            conn.execute_batch("PRAGMA synchronous = NORMAL;")?;
            Err(e)
        }
    }
}
