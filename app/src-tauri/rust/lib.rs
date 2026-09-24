//! MagicTrainer Rust side. Sources live in `rust/` (see Cargo.toml). Modules:
//! - `normalize`  card-name normalization (golden-tested against the TS twin)
//! - `db`         SQLite open/migrate/meta
//! - `import`     streaming bulk importers (Scryfall JSONL.gz, Spellbook variants)
//! - `download`   bulk downloads with progress
//! - `commands`   the Tauri command surface

pub mod commands;
pub mod db;
pub mod download;
pub mod error;
pub mod import;
pub mod normalize;
pub mod progress;
pub mod rules;

use tauri::Manager;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_dialog::init())
        .setup(|app| {
            let state = commands::AppState::from_app(app.handle())?;
            app.manage(state);
            app.manage(rules::RulesState::default());
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            commands::db_status,
            commands::db_query,
            commands::import_bulk,
            commands::scryfall_bulk_index,
            rules::rules_status,
            rules::rules_search,
            rules::rules_get,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
