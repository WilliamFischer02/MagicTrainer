//! MagicTrainer Rust side. Sources live in `rust/` (see Cargo.toml). Modules:
//! - `normalize`  card-name normalization (golden-tested against the TS twin)
//! - `db`         SQLite open/migrate/meta
//! - `import`     streaming bulk importers (Scryfall JSONL.gz, Spellbook variants)
//! - `download`   bulk downloads with progress
//! - `net`        User-Agent, HTTP agent, rate limiter shared by every outbound path
//! - `images`     card-image disk cache behind the `mtimg://` custom protocol
//! - `spellbook_api` Commander Spellbook `find-my-combos` client with a 24 h disk cache
//! - `decks`      deck save/delete + import-file reading (writes; reads go through `db_query`)
//! - `commands`   the Tauri command surface

pub mod commands;
pub mod db;
pub mod decks;
pub mod download;
pub mod error;
pub mod images;
pub mod import;
pub mod net;
pub mod normalize;
pub mod progress;
pub mod rules;
pub mod spellbook_api;

use tauri::Manager;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_dialog::init())
        .register_asynchronous_uri_scheme_protocol(images::SCHEME, images::handle_protocol)
        .setup(|app| {
            let state = commands::AppState::from_app(app.handle())?;
            app.manage(images::ImageCache::new(state.cache_dir.join("images")));
            app.manage(spellbook_api::ComboClient::new(state.cache_dir.join("spellbook")));
            app.manage(state);
            app.manage(rules::RulesState::default());
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            commands::db_status,
            commands::db_query,
            commands::import_bulk,
            commands::scryfall_bulk_index,
            images::image_cache_status,
            images::image_cache_clear,
            images::image_prefetch,
            spellbook_api::find_my_combos,
            spellbook_api::combo_cache_status,
            spellbook_api::combo_cache_clear,
            decks::read_import_file,
            decks::deck_save,
            decks::deck_delete,
            rules::rules_status,
            rules::rules_search,
            rules::rules_get,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
