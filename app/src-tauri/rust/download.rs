//! Bulk-file downloads with progress. Scryfall: list `/bulk-data`, then fetch the
//! `jsonl_download_uri` for each wanted type (≤ 10 req/s, descriptive User-Agent —
//! `knowledge/mtg-data-apis/scryfall/api_rate-limits.md`). Commander Spellbook: one static URL.

use std::io::{Read, Write};
use std::path::Path;
use std::time::Duration;

use serde::Deserialize;

use crate::error::{msg, Result};
use crate::import::Part;
use crate::progress::{ProgressSink, Stage};

pub const USER_AGENT: &str = "MagicTrainer/0.1 (github.com/WilliamFischer02/MagicTrainer)";
pub const SCRYFALL_BULK_INDEX: &str = "https://api.scryfall.com/bulk-data";
pub const SPELLBOOK_VARIANTS_URL: &str = "https://json.commanderspellbook.com/variants.json.gz";

#[derive(Debug, Clone, Deserialize, serde::Serialize)]
pub struct BulkEntry {
    pub r#type: String,
    pub name: String,
    pub updated_at: String,
    #[serde(default)]
    pub jsonl_download_uri: Option<String>,
    #[serde(default)]
    pub download_uri: Option<String>,
    #[serde(default)]
    pub compressed_size: Option<u64>,
}

#[derive(Debug, Deserialize)]
struct BulkIndex {
    data: Vec<BulkEntry>,
}

fn agent() -> ureq::Agent {
    ureq::Agent::config_builder()
        .timeout_global(Some(Duration::from_secs(60 * 30)))
        .user_agent(USER_AGENT)
        .build()
        .into()
}

pub fn list_scryfall_bulk() -> Result<Vec<BulkEntry>> {
    let mut resp = agent().get(SCRYFALL_BULK_INDEX).header("Accept", "application/json").call()?;
    let text = resp.body_mut().read_to_string()?;
    let idx: BulkIndex = serde_json::from_str(&text)?;
    Ok(idx.data)
}

/// Stream `url` to `dest` (via a `.part` file, renamed on success). Returns bytes written.
pub fn download_to(url: &str, dest: &Path, stage: &Stage) -> Result<u64> {
    if let Some(parent) = dest.parent() {
        std::fs::create_dir_all(parent)?;
    }
    let part = dest.with_extension(format!(
        "{}.part",
        dest.extension().and_then(|e| e.to_str()).unwrap_or("bin")
    ));
    let mut resp = agent().get(url).call()?;
    if resp.status().as_u16() >= 400 {
        return Err(msg(format!("GET {url} → HTTP {}", resp.status())));
    }
    let mut reader = resp.body_mut().as_reader();
    let mut file = std::io::BufWriter::with_capacity(1 << 20, std::fs::File::create(&part)?);
    let mut buf = vec![0u8; 1 << 16];
    let mut written = 0u64;
    loop {
        let n = reader.read(&mut buf)?;
        if n == 0 {
            break;
        }
        file.write_all(&buf[..n])?;
        written += n as u64;
        stage.tick(written, format!("{:.1} MB", written as f64 / 1e6));
    }
    file.flush()?;
    drop(file);
    std::fs::rename(&part, dest)?;
    Ok(written)
}

#[derive(Debug, Clone, serde::Serialize)]
#[serde(rename_all = "camelCase")]
pub struct Downloaded {
    pub part: Part,
    pub url: String,
    pub file: String,
    pub bytes: u64,
    pub updated_at: Option<String>,
}

/// Download every requested part into `data_dir` (same layout as `scripts/fetch-data.ps1`).
pub fn download_parts(data_dir: &Path, parts: &[Part], sink: &dyn ProgressSink) -> Result<Vec<Downloaded>> {
    let needs_scryfall = parts.iter().any(|p| p.scryfall_type().is_some());
    let index = if needs_scryfall { list_scryfall_bulk()? } else { Vec::new() };
    let mut out = Vec::new();
    for &part in parts {
        let dest = data_dir.join(part.file_name());
        let (url, size, updated) = match part.scryfall_type() {
            Some(t) => {
                let entry = index
                    .iter()
                    .find(|e| e.r#type == t)
                    .ok_or_else(|| msg(format!("Scryfall bulk index has no entry of type {t}")))?;
                let url = entry
                    .jsonl_download_uri
                    .clone()
                    .or_else(|| entry.download_uri.clone())
                    .ok_or_else(|| msg(format!("Scryfall bulk entry {t} has no download uri")))?;
                (url, entry.compressed_size, Some(entry.updated_at.clone()))
            }
            None => (SPELLBOOK_VARIANTS_URL.to_string(), None, None),
        };
        let stage = Stage::new(sink, format!("download:{}", part.file_name()), size);
        let bytes = download_to(&url, &dest, &stage)?;
        stage.finish(bytes, format!("{:.1} MB", bytes as f64 / 1e6));
        out.push(Downloaded { part, url, file: dest.display().to_string(), bytes, updated_at: updated });
        std::thread::sleep(Duration::from_millis(150));
    }
    Ok(out)
}
