//! Dev CLI: import bulk files from a data directory into a SQLite DB, or download them first.
//!
//!   cargo run --bin magictrainer-import -- --data ../../data --db ../../data/magictrainer.sqlite
//!   cargo run --bin magictrainer-import -- --data ../../data --download --parts oracle_cards,rulings
//!
//! Same code path as the Tauri `import_bulk` command, with stdout progress.

use std::path::PathBuf;
use std::process::ExitCode;

use magictrainer_lib::import::{self, Part};
use magictrainer_lib::progress::StdoutSink;
use magictrainer_lib::{download, error::Result};

fn usage() -> ExitCode {
    eprintln!(
        "usage: magictrainer-import --data <dir> [--db <file>] [--download] [--parts oracle_cards,printings,rulings,oracle_tags,spellbook]"
    );
    ExitCode::from(2)
}

fn parse_part(s: &str) -> Option<Part> {
    match s.trim() {
        "oracle_cards" | "oracle" | "cards" => Some(Part::OracleCards),
        "printings" | "default_cards" => Some(Part::Printings),
        "rulings" => Some(Part::Rulings),
        "oracle_tags" | "tags" => Some(Part::OracleTags),
        "spellbook" | "variants" => Some(Part::Spellbook),
        _ => None,
    }
}

fn run() -> Result<bool> {
    let mut args = std::env::args().skip(1);
    let mut data: Option<PathBuf> = None;
    let mut db: Option<PathBuf> = None;
    let mut download_first = false;
    let mut parts: Vec<Part> = Part::ALL.to_vec();
    while let Some(a) = args.next() {
        match a.as_str() {
            "--data" => data = args.next().map(PathBuf::from),
            "--db" => db = args.next().map(PathBuf::from),
            "--download" => download_first = true,
            "--parts" => {
                let list = args.next().unwrap_or_default();
                parts = list.split(',').filter_map(parse_part).collect();
                if parts.is_empty() {
                    return Ok(false);
                }
            }
            _ => return Ok(false),
        }
    }
    let Some(data) = data else { return Ok(false) };
    let db = db.unwrap_or_else(|| data.join("magictrainer.sqlite"));
    let sink = StdoutSink;
    let started = std::time::Instant::now();
    if download_first {
        for d in download::download_parts(&data, &parts, &sink)? {
            println!("downloaded {:?} → {} ({:.1} MB)", d.part, d.file, d.bytes as f64 / 1e6);
        }
    }
    let report = import::import_dir(&data, &db, &parts, &sink)?;
    println!();
    for p in &report.parts {
        match &p.skipped {
            Some(why) => println!("{:<12} skipped: {why} ({})", p.part, p.file),
            None => println!("{:<12} {:>9} rows  {:>7} ignored  {:>6.1}s", p.part, p.rows, p.ignored, p.seconds),
        }
    }
    println!("\ncounts: {:?}", report.counts);
    println!("db: {} ({:.1}s total)", db.display(), started.elapsed().as_secs_f64());
    Ok(true)
}

fn main() -> ExitCode {
    match run() {
        Ok(true) => ExitCode::SUCCESS,
        Ok(false) => usage(),
        Err(e) => {
            eprintln!("error: {e}");
            ExitCode::FAILURE
        }
    }
}
