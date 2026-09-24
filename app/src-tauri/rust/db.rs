//! SQLite database: open, migrate, meta. Schema mirrors `docs/DATA_MODEL.md` (v1).
//!
//! Writes happen only in Rust (importers and, later, deck/collection commands). The
//! frontend gets a read-only connection through the `db_query` command.

use std::path::Path;

use rusqlite::{Connection, OpenFlags, OptionalExtension};

use crate::error::Result;

pub const SCHEMA_VERSION: i64 = 1;

pub const SCHEMA_V1: &str = r#"
CREATE TABLE IF NOT EXISTS meta (key TEXT PRIMARY KEY, value TEXT NOT NULL);

CREATE TABLE IF NOT EXISTS cards (
  oracle_id        TEXT PRIMARY KEY,
  name             TEXT NOT NULL,
  name_norm        TEXT NOT NULL,
  name_loose       TEXT NOT NULL,
  layout           TEXT NOT NULL,
  mana_cost        TEXT,
  cmc              REAL NOT NULL DEFAULT 0,
  type_line        TEXT NOT NULL DEFAULT '',
  oracle_text      TEXT,
  colors           TEXT NOT NULL DEFAULT '[]',
  color_identity   TEXT NOT NULL DEFAULT '[]',
  keywords         TEXT NOT NULL DEFAULT '[]',
  produced_mana    TEXT,
  power            TEXT,
  toughness        TEXT,
  loyalty          TEXT,
  defense          TEXT,
  legalities       TEXT NOT NULL DEFAULT '{}',
  edhrec_rank      INTEGER,
  game_changer     INTEGER NOT NULL DEFAULT 0,
  reserved         INTEGER NOT NULL DEFAULT 0,
  set_code         TEXT,
  set_name         TEXT,
  set_type         TEXT,
  collector_number TEXT,
  released_at      TEXT,
  rarity           TEXT,
  repr_printing_id TEXT,
  image_small      TEXT,
  image_normal     TEXT,
  image_large      TEXT,
  image_art_crop   TEXT,
  faces            TEXT,
  prices           TEXT,
  purchase_uris    TEXT,
  scryfall_uri     TEXT,
  updated_at       TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_cards_name_norm  ON cards(name_norm);
CREATE INDEX IF NOT EXISTS idx_cards_name_loose ON cards(name_loose);

-- Every name that should resolve to a card: the full name plus each face name.
CREATE TABLE IF NOT EXISTS card_names (
  name_norm TEXT NOT NULL,
  oracle_id TEXT NOT NULL,
  kind      TEXT NOT NULL,   -- 'full' | 'face'
  PRIMARY KEY (name_norm, oracle_id)
);

CREATE VIRTUAL TABLE IF NOT EXISTS cards_fts USING fts5(
  name, oracle_id UNINDEXED, tokenize = 'unicode61 remove_diacritics 2'
);

CREATE TABLE IF NOT EXISTS printings (
  id               TEXT PRIMARY KEY,
  oracle_id        TEXT NOT NULL,
  name             TEXT NOT NULL,
  set_code         TEXT NOT NULL,
  set_name         TEXT,
  set_type         TEXT,
  collector_number TEXT NOT NULL,
  rarity           TEXT,
  lang             TEXT,
  released_at      TEXT,
  finishes         TEXT NOT NULL DEFAULT '[]',
  digital          INTEGER NOT NULL DEFAULT 0,
  promo            INTEGER NOT NULL DEFAULT 0,
  full_art         INTEGER NOT NULL DEFAULT 0,
  border_color     TEXT,
  frame_effects    TEXT,
  artist           TEXT,
  price_usd        REAL,
  price_usd_foil   REAL,
  price_usd_etched REAL,
  image_small      TEXT,
  image_normal     TEXT,
  image_large      TEXT,
  image_art_crop   TEXT,
  purchase_uris    TEXT
);
CREATE INDEX IF NOT EXISTS idx_printings_oracle ON printings(oracle_id);
CREATE INDEX IF NOT EXISTS idx_printings_set_cn ON printings(set_code, collector_number);

CREATE TABLE IF NOT EXISTS oracle_tags (
  id            TEXT PRIMARY KEY,
  slug          TEXT NOT NULL,
  label         TEXT NOT NULL,
  description   TEXT,
  parent_ids    TEXT NOT NULL DEFAULT '[]',
  child_ids     TEXT NOT NULL DEFAULT '[]',
  aliases       TEXT NOT NULL DEFAULT '[]',
  tagging_count INTEGER NOT NULL DEFAULT 0
);
CREATE INDEX IF NOT EXISTS idx_oracle_tags_slug ON oracle_tags(slug);

-- Direct taggings only (as shipped by Scryfall).
CREATE TABLE IF NOT EXISTS card_oracle_tags (
  oracle_id  TEXT NOT NULL,
  tag_id     TEXT NOT NULL,
  weight     TEXT NOT NULL,
  annotation TEXT,
  PRIMARY KEY (oracle_id, tag_id)
);
CREATE INDEX IF NOT EXISTS idx_card_oracle_tags_tag ON card_oracle_tags(tag_id);

-- Transitive closure of the tag hierarchy, including (tag, tag) itself, so
-- "cards tagged X or any child of X" is one join.
CREATE TABLE IF NOT EXISTS oracle_tag_ancestors (
  tag_id      TEXT NOT NULL,
  ancestor_id TEXT NOT NULL,
  depth       INTEGER NOT NULL,
  PRIMARY KEY (tag_id, ancestor_id)
);
CREATE INDEX IF NOT EXISTS idx_oracle_tag_ancestors_anc ON oracle_tag_ancestors(ancestor_id);

CREATE TABLE IF NOT EXISTS rulings (
  oracle_id    TEXT NOT NULL,
  published_at TEXT NOT NULL,
  source       TEXT,
  comment      TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_rulings_oracle ON rulings(oracle_id);

CREATE TABLE IF NOT EXISTS spellbook_variants (
  id              TEXT PRIMARY KEY,
  status          TEXT NOT NULL,
  identity        TEXT NOT NULL,
  card_count      INTEGER NOT NULL,
  popularity      INTEGER,
  bracket_tag     TEXT,
  mana_needed     TEXT,
  mana_value      INTEGER,
  description     TEXT,
  prerequisites   TEXT,
  produces        TEXT NOT NULL DEFAULT '[]',
  legal_commander INTEGER NOT NULL DEFAULT 0,
  json            TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS spellbook_variant_cards (
  variant_id        TEXT NOT NULL,
  oracle_id         TEXT NOT NULL,
  card_name         TEXT NOT NULL,
  quantity          INTEGER NOT NULL DEFAULT 1,
  zone_locations    TEXT NOT NULL DEFAULT '[]',
  must_be_commander INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (variant_id, oracle_id)
);
CREATE INDEX IF NOT EXISTS idx_sbvc_oracle ON spellbook_variant_cards(oracle_id);

-- User data (Phase 2 fills these; schema reserved now so migrations stay linear).
CREATE TABLE IF NOT EXISTS decks (
  id            TEXT PRIMARY KEY,
  name          TEXT NOT NULL,
  format        TEXT,
  source_format TEXT NOT NULL,
  raw           TEXT NOT NULL,
  created_at    TEXT NOT NULL,
  updated_at    TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS deck_entries (
  deck_id          TEXT NOT NULL,
  section          TEXT NOT NULL,
  position         INTEGER NOT NULL,
  name             TEXT NOT NULL,
  quantity         INTEGER NOT NULL,
  set_code         TEXT,
  collector_number TEXT,
  oracle_id        TEXT,
  PRIMARY KEY (deck_id, section, position)
);
CREATE TABLE IF NOT EXISTS collection (
  id               INTEGER PRIMARY KEY,
  printing_id      TEXT,
  oracle_id        TEXT,
  name             TEXT NOT NULL,
  set_code         TEXT,
  collector_number TEXT,
  quantity         INTEGER NOT NULL,
  foil             INTEGER NOT NULL DEFAULT 0,
  condition        TEXT,
  language         TEXT,
  source_format    TEXT NOT NULL,
  raw_json         TEXT NOT NULL,
  imported_at      TEXT NOT NULL
);
"#;

pub fn open_rw(path: &Path) -> Result<Connection> {
    if let Some(parent) = path.parent() {
        std::fs::create_dir_all(parent)?;
    }
    let conn = Connection::open(path)?;
    conn.execute_batch(
        "PRAGMA journal_mode = WAL;
         PRAGMA synchronous = NORMAL;
         PRAGMA temp_store = MEMORY;
         PRAGMA foreign_keys = OFF;",
    )?;
    migrate(&conn)?;
    Ok(conn)
}

pub fn open_ro(path: &Path) -> Result<Connection> {
    let conn = Connection::open_with_flags(path, OpenFlags::SQLITE_OPEN_READ_ONLY | OpenFlags::SQLITE_OPEN_NO_MUTEX)?;
    conn.execute_batch("PRAGMA query_only = ON;")?;
    Ok(conn)
}

pub fn migrate(conn: &Connection) -> Result<()> {
    let version: i64 = conn.query_row("PRAGMA user_version", [], |r| r.get(0))?;
    if version < 1 {
        conn.execute_batch(SCHEMA_V1)?;
        conn.pragma_update(None, "user_version", SCHEMA_VERSION)?;
        meta_set(conn, "schema_version", &SCHEMA_VERSION.to_string())?;
    }
    Ok(())
}

pub fn meta_get(conn: &Connection, key: &str) -> Result<Option<String>> {
    Ok(conn
        .query_row("SELECT value FROM meta WHERE key = ?1", [key], |r| r.get(0))
        .optional()?)
}

pub fn meta_set(conn: &Connection, key: &str, value: &str) -> Result<()> {
    conn.execute(
        "INSERT INTO meta(key, value) VALUES (?1, ?2) ON CONFLICT(key) DO UPDATE SET value = excluded.value",
        [key, value],
    )?;
    Ok(())
}

pub fn count(conn: &Connection, table: &str) -> Result<i64> {
    Ok(conn.query_row(&format!("SELECT COUNT(*) FROM {table}"), [], |r| r.get(0))?)
}

pub fn now_iso() -> String {
    // RFC 3339 UTC without pulling in chrono: seconds since epoch → civil date.
    let secs = std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .map(|d| d.as_secs() as i64)
        .unwrap_or(0);
    let days = secs.div_euclid(86_400);
    let rem = secs.rem_euclid(86_400);
    let (y, m, d) = civil_from_days(days);
    format!("{y:04}-{m:02}-{d:02}T{:02}:{:02}:{:02}Z", rem / 3600, (rem % 3600) / 60, rem % 60)
}

// Howard Hinnant's algorithm (public domain).
fn civil_from_days(z: i64) -> (i64, u32, u32) {
    let z = z + 719_468;
    let era = z.div_euclid(146_097);
    let doe = z.rem_euclid(146_097);
    let yoe = (doe - doe / 1460 + doe / 36_524 - doe / 146_096) / 365;
    let y = yoe + era * 400;
    let doy = doe - (365 * yoe + yoe / 4 - yoe / 100);
    let mp = (5 * doy + 2) / 153;
    let d = (doy - (153 * mp + 2) / 5 + 1) as u32;
    let m = if mp < 10 { mp + 3 } else { mp - 9 } as u32;
    (if m <= 2 { y + 1 } else { y }, m, d)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn schema_applies_to_memory_db() {
        let conn = Connection::open_in_memory().unwrap();
        migrate(&conn).unwrap();
        migrate(&conn).unwrap(); // idempotent
        assert_eq!(meta_get(&conn, "schema_version").unwrap().as_deref(), Some("1"));
        assert_eq!(count(&conn, "cards").unwrap(), 0);
        conn.execute("INSERT INTO cards_fts(name, oracle_id) VALUES ('Séance', 'x')", []).unwrap();
        let hit: String = conn
            .query_row("SELECT oracle_id FROM cards_fts WHERE cards_fts MATCH 'seance'", [], |r| r.get(0))
            .unwrap();
        assert_eq!(hit, "x");
    }

    #[test]
    fn now_iso_is_rfc3339() {
        let s = now_iso();
        assert_eq!(s.len(), 20);
        assert!(s.starts_with("20"));
        assert!(s.ends_with('Z'));
    }

    #[test]
    fn civil_dates() {
        assert_eq!(civil_from_days(0), (1970, 1, 1));
        assert_eq!(civil_from_days(20_720), (2026, 9, 24));
    }
}
