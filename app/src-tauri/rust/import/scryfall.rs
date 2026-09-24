//! Scryfall bulk importers: oracle cards, printings (default_cards), rulings, oracle tags.
//! Each file is JSONL.gz (one object per line) and is streamed line by line.

use std::collections::{HashMap, HashSet};
use std::io::BufRead;
use std::path::Path;
use std::sync::atomic::Ordering;

use rusqlite::{params, Connection, Transaction};
use serde::{Deserialize, Serialize};

use super::{json_or_empty_array, open_gz_lines, opt_json, with_bulk_tx, Stats};
use crate::db;
use crate::error::Result;
use crate::normalize::{loose_card_key, normalize_card_name, split_face_names};
use crate::progress::{ProgressSink, Stage};

#[derive(Debug, Default, Deserialize, Serialize, Clone)]
pub struct ImageUris {
    pub small: Option<String>,
    pub normal: Option<String>,
    pub large: Option<String>,
    pub art_crop: Option<String>,
}

/// One face of a multi-face card; kept as JSON in `cards.faces`.
#[derive(Debug, Default, Deserialize, Serialize, Clone)]
pub struct Face {
    pub name: String,
    #[serde(default)]
    pub mana_cost: Option<String>,
    #[serde(default)]
    pub type_line: Option<String>,
    #[serde(default)]
    pub oracle_text: Option<String>,
    #[serde(default)]
    pub colors: Option<Vec<String>>,
    #[serde(default)]
    pub power: Option<String>,
    #[serde(default)]
    pub toughness: Option<String>,
    #[serde(default)]
    pub loyalty: Option<String>,
    #[serde(default)]
    pub defense: Option<String>,
    #[serde(default)]
    pub image_uris: Option<ImageUris>,
    #[serde(default, skip_serializing)]
    pub oracle_id: Option<String>,
}

/// The subset of a Scryfall card object we persist. Unknown fields are ignored.
#[derive(Debug, Default, Deserialize)]
pub struct ScryCard {
    pub id: String,
    #[serde(default)]
    pub oracle_id: Option<String>,
    pub name: String,
    #[serde(default)]
    pub layout: String,
    #[serde(default)]
    pub lang: Option<String>,
    #[serde(default)]
    pub mana_cost: Option<String>,
    #[serde(default)]
    pub cmc: Option<f64>,
    #[serde(default)]
    pub type_line: Option<String>,
    #[serde(default)]
    pub oracle_text: Option<String>,
    #[serde(default)]
    pub colors: Option<Vec<String>>,
    #[serde(default)]
    pub color_identity: Vec<String>,
    #[serde(default)]
    pub keywords: Vec<String>,
    #[serde(default)]
    pub produced_mana: Option<Vec<String>>,
    #[serde(default)]
    pub power: Option<String>,
    #[serde(default)]
    pub toughness: Option<String>,
    #[serde(default)]
    pub loyalty: Option<String>,
    #[serde(default)]
    pub defense: Option<String>,
    #[serde(default)]
    pub legalities: serde_json::Map<String, serde_json::Value>,
    #[serde(default)]
    pub edhrec_rank: Option<i64>,
    #[serde(default)]
    pub game_changer: Option<bool>,
    #[serde(default)]
    pub reserved: Option<bool>,
    #[serde(default)]
    pub set: Option<String>,
    #[serde(default)]
    pub set_name: Option<String>,
    #[serde(default)]
    pub set_type: Option<String>,
    #[serde(default)]
    pub collector_number: Option<String>,
    #[serde(default)]
    pub released_at: Option<String>,
    #[serde(default)]
    pub rarity: Option<String>,
    #[serde(default)]
    pub image_uris: Option<ImageUris>,
    #[serde(default)]
    pub card_faces: Vec<Face>,
    #[serde(default)]
    pub prices: Option<serde_json::Value>,
    #[serde(default)]
    pub purchase_uris: Option<serde_json::Value>,
    #[serde(default)]
    pub scryfall_uri: Option<String>,
    #[serde(default)]
    pub finishes: Vec<String>,
    #[serde(default)]
    pub digital: Option<bool>,
    #[serde(default)]
    pub promo: Option<bool>,
    #[serde(default)]
    pub full_art: Option<bool>,
    #[serde(default)]
    pub border_color: Option<String>,
    #[serde(default)]
    pub frame_effects: Option<Vec<String>>,
    #[serde(default)]
    pub artist: Option<String>,
}

impl ScryCard {
    /// Top-level oracle_id, or the first face's (reversible cards carry it per face).
    pub fn effective_oracle_id(&self) -> Option<&str> {
        self.oracle_id
            .as_deref()
            .or_else(|| self.card_faces.iter().find_map(|f| f.oracle_id.as_deref()))
    }

    /// Image URIs for display: top-level when present, else the front face's.
    pub fn display_images(&self) -> Option<&ImageUris> {
        self.image_uris
            .as_ref()
            .or_else(|| self.card_faces.first().and_then(|f| f.image_uris.as_ref()))
    }
}

fn price(v: &Option<serde_json::Value>, key: &str) -> Option<f64> {
    v.as_ref()?.get(key)?.as_str()?.parse().ok()
}

pub fn import_oracle_cards(conn: &mut Connection, path: &Path, sink: &dyn ProgressSink) -> Result<Stats> {
    let (lines, read, total) = open_gz_lines(path)?;
    let stage = Stage::new(sink, "import:oracle_cards", Some(total));
    let now = db::now_iso();
    let stats = with_bulk_tx(conn, |tx| {
        tx.execute_batch("DELETE FROM cards; DELETE FROM card_names; DELETE FROM cards_fts;")?;
        let mut ins = tx.prepare_cached(
            "INSERT OR REPLACE INTO cards (
               oracle_id, name, name_norm, name_loose, layout, mana_cost, cmc, type_line, oracle_text,
               colors, color_identity, keywords, produced_mana, power, toughness, loyalty, defense,
               legalities, edhrec_rank, game_changer, reserved, set_code, set_name, set_type,
               collector_number, released_at, rarity, repr_printing_id,
               image_small, image_normal, image_large, image_art_crop,
               faces, prices, purchase_uris, scryfall_uri, updated_at
             ) VALUES (?1,?2,?3,?4,?5,?6,?7,?8,?9,?10,?11,?12,?13,?14,?15,?16,?17,?18,?19,?20,?21,?22,?23,?24,?25,?26,?27,?28,?29,?30,?31,?32,?33,?34,?35,?36,?37)",
        )?;
        let mut ins_name = tx.prepare_cached("INSERT OR IGNORE INTO card_names (name_norm, oracle_id, kind) VALUES (?1, ?2, ?3)")?;
        let mut stats = Stats::default();
        for line in lines.lines() {
            let line = line?;
            if line.trim().is_empty() {
                continue;
            }
            let card: ScryCard = match serde_json::from_str(&line) {
                Ok(c) => c,
                Err(e) => {
                    stats.ignored += 1;
                    if stats.ignored <= 5 {
                        eprintln!("oracle_cards: skipping unparsable line: {e}");
                    }
                    continue;
                }
            };
            let Some(oracle_id) = card.effective_oracle_id().map(str::to_string) else {
                stats.ignored += 1;
                continue;
            };
            let name_norm = normalize_card_name(&card.name);
            let name_loose = loose_card_key(&card.name);
            let images = card.display_images().cloned().unwrap_or_default();
            let faces_json = if card.card_faces.is_empty() { None } else { Some(json_or_empty_array(&card.card_faces)) };
            ins.execute(params![
                oracle_id,
                card.name,
                name_norm,
                name_loose,
                card.layout,
                card.mana_cost,
                card.cmc.unwrap_or(0.0),
                card.type_line.clone().unwrap_or_default(),
                card.oracle_text,
                json_or_empty_array(card.colors.as_deref().unwrap_or(&[])),
                json_or_empty_array(&card.color_identity),
                json_or_empty_array(&card.keywords),
                card.produced_mana.as_ref().map(|v| json_or_empty_array(v)),
                card.power,
                card.toughness,
                card.loyalty,
                card.defense,
                serde_json::Value::Object(card.legalities.clone()).to_string(),
                card.edhrec_rank,
                card.game_changer.unwrap_or(false) as i64,
                card.reserved.unwrap_or(false) as i64,
                card.set,
                card.set_name,
                card.set_type,
                card.collector_number,
                card.released_at,
                card.rarity,
                card.id,
                images.small,
                images.normal,
                images.large,
                images.art_crop,
                faces_json,
                opt_json(&card.prices),
                opt_json(&card.purchase_uris),
                card.scryfall_uri,
                now,
            ])?;
            ins_name.execute(params![name_norm, oracle_id, "full"])?;
            let faces = split_face_names(&name_norm);
            if faces.len() > 1 {
                for f in faces {
                    ins_name.execute(params![f, oracle_id, "face"])?;
                }
            }
            stats.rows += 1;
            if stats.rows.is_multiple_of(500) {
                stage.tick(read.load(Ordering::Relaxed), format!("{} cards", stats.rows));
            }
        }
        drop(ins);
        drop(ins_name);
        tx.execute_batch("INSERT INTO cards_fts(name, oracle_id) SELECT name, oracle_id FROM cards;")?;
        Ok(stats)
    })?;
    stage.finish(total, format!("{} oracle cards", stats.rows));
    Ok(stats)
}

pub fn import_printings(conn: &mut Connection, path: &Path, sink: &dyn ProgressSink) -> Result<Stats> {
    let (lines, read, total) = open_gz_lines(path)?;
    let stage = Stage::new(sink, "import:printings", Some(total));
    let stats = with_bulk_tx(conn, |tx| {
        tx.execute_batch("DELETE FROM printings;")?;
        let mut ins = tx.prepare_cached(
            "INSERT OR REPLACE INTO printings (
               id, oracle_id, name, set_code, set_name, set_type, collector_number, rarity, lang, released_at,
               finishes, digital, promo, full_art, border_color, frame_effects, artist,
               price_usd, price_usd_foil, price_usd_etched,
               image_small, image_normal, image_large, image_art_crop, purchase_uris
             ) VALUES (?1,?2,?3,?4,?5,?6,?7,?8,?9,?10,?11,?12,?13,?14,?15,?16,?17,?18,?19,?20,?21,?22,?23,?24,?25)",
        )?;
        let mut stats = Stats::default();
        for line in lines.lines() {
            let line = line?;
            if line.trim().is_empty() {
                continue;
            }
            let card: ScryCard = match serde_json::from_str(&line) {
                Ok(c) => c,
                Err(_) => {
                    stats.ignored += 1;
                    continue;
                }
            };
            let Some(oracle_id) = card.effective_oracle_id().map(str::to_string) else {
                stats.ignored += 1;
                continue;
            };
            let images = card.display_images().cloned().unwrap_or_default();
            ins.execute(params![
                card.id,
                oracle_id,
                card.name,
                card.set.clone().unwrap_or_default(),
                card.set_name,
                card.set_type,
                card.collector_number.clone().unwrap_or_default(),
                card.rarity,
                card.lang,
                card.released_at,
                json_or_empty_array(&card.finishes),
                card.digital.unwrap_or(false) as i64,
                card.promo.unwrap_or(false) as i64,
                card.full_art.unwrap_or(false) as i64,
                card.border_color,
                card.frame_effects.as_ref().map(|v| json_or_empty_array(v)),
                card.artist,
                price(&card.prices, "usd"),
                price(&card.prices, "usd_foil"),
                price(&card.prices, "usd_etched"),
                images.small,
                images.normal,
                images.large,
                images.art_crop,
                opt_json(&card.purchase_uris),
            ])?;
            stats.rows += 1;
            if stats.rows.is_multiple_of(2000) {
                stage.tick(read.load(Ordering::Relaxed), format!("{} printings", stats.rows));
            }
        }
        Ok(stats)
    })?;
    stage.finish(total, format!("{} printings", stats.rows));
    Ok(stats)
}

#[derive(Debug, Deserialize)]
struct Ruling {
    oracle_id: String,
    #[serde(default)]
    source: Option<String>,
    published_at: String,
    comment: String,
}

pub fn import_rulings(conn: &mut Connection, path: &Path, sink: &dyn ProgressSink) -> Result<Stats> {
    let (lines, read, total) = open_gz_lines(path)?;
    let stage = Stage::new(sink, "import:rulings", Some(total));
    let stats = with_bulk_tx(conn, |tx| {
        tx.execute_batch("DELETE FROM rulings;")?;
        let mut ins = tx.prepare_cached("INSERT INTO rulings (oracle_id, published_at, source, comment) VALUES (?1, ?2, ?3, ?4)")?;
        let mut stats = Stats::default();
        for line in lines.lines() {
            let line = line?;
            if line.trim().is_empty() {
                continue;
            }
            let r: Ruling = match serde_json::from_str(&line) {
                Ok(r) => r,
                Err(_) => {
                    stats.ignored += 1;
                    continue;
                }
            };
            ins.execute(params![r.oracle_id, r.published_at, r.source, r.comment])?;
            stats.rows += 1;
            if stats.rows.is_multiple_of(5000) {
                stage.tick(read.load(Ordering::Relaxed), format!("{} rulings", stats.rows));
            }
        }
        Ok(stats)
    })?;
    stage.finish(total, format!("{} rulings", stats.rows));
    Ok(stats)
}

#[derive(Debug, Deserialize)]
struct Tagging {
    #[serde(default)]
    oracle_id: Option<String>,
    #[serde(default)]
    weight: Option<String>,
    #[serde(default)]
    annotation: Option<String>,
}

#[derive(Debug, Deserialize)]
struct Tag {
    id: String,
    slug: String,
    label: String,
    #[serde(default)]
    r#type: Option<String>,
    #[serde(default)]
    description: Option<String>,
    #[serde(default)]
    parent_ids: Option<Vec<String>>,
    #[serde(default)]
    child_ids: Option<Vec<String>>,
    #[serde(default)]
    aliases: Option<Vec<String>>,
    #[serde(default)]
    taggings: Vec<Tagging>,
}

pub fn import_oracle_tags(conn: &mut Connection, path: &Path, sink: &dyn ProgressSink) -> Result<Stats> {
    let (lines, read, total) = open_gz_lines(path)?;
    let stage = Stage::new(sink, "import:oracle_tags", Some(total));
    let stats = with_bulk_tx(conn, |tx| {
        tx.execute_batch("DELETE FROM oracle_tags; DELETE FROM card_oracle_tags; DELETE FROM oracle_tag_ancestors;")?;
        let mut ins_tag = tx.prepare_cached(
            "INSERT OR REPLACE INTO oracle_tags (id, slug, label, description, parent_ids, child_ids, aliases, tagging_count)
             VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8)",
        )?;
        let mut ins_tagging = tx.prepare_cached(
            "INSERT OR IGNORE INTO card_oracle_tags (oracle_id, tag_id, weight, annotation) VALUES (?1, ?2, ?3, ?4)",
        )?;
        let mut parents: HashMap<String, Vec<String>> = HashMap::new();
        let mut stats = Stats::default();
        let mut tags = 0u64;
        for line in lines.lines() {
            let line = line?;
            if line.trim().is_empty() {
                continue;
            }
            let tag: Tag = match serde_json::from_str(&line) {
                Ok(t) => t,
                Err(e) => {
                    stats.ignored += 1;
                    if stats.ignored <= 5 {
                        eprintln!("oracle_tags: skipping unparsable line: {e}");
                    }
                    continue;
                }
            };
            if matches!(tag.r#type.as_deref(), Some(t) if t != "oracle") {
                stats.ignored += 1;
                continue;
            }
            let parent_ids = tag.parent_ids.unwrap_or_default();
            ins_tag.execute(params![
                tag.id,
                tag.slug,
                tag.label,
                tag.description,
                json_or_empty_array(&parent_ids),
                json_or_empty_array(&tag.child_ids.unwrap_or_default()),
                json_or_empty_array(&tag.aliases.unwrap_or_default()),
                tag.taggings.len() as i64,
            ])?;
            for t in &tag.taggings {
                let Some(oid) = &t.oracle_id else { continue };
                ins_tagging.execute(params![oid, tag.id, t.weight.as_deref().unwrap_or("median"), t.annotation])?;
                stats.rows += 1;
            }
            parents.insert(tag.id.clone(), parent_ids);
            tags += 1;
            if tags.is_multiple_of(50) {
                stage.tick(read.load(Ordering::Relaxed), format!("{tags} tags, {} taggings", stats.rows));
            }
        }
        drop(ins_tag);
        drop(ins_tagging);
        insert_ancestor_closure(tx, &parents)?;
        Ok(stats)
    })?;
    stage.finish(total, format!("{} taggings", stats.rows));
    Ok(stats)
}

/// (tag, ancestor, depth) for every ancestor including the tag itself at depth 0. Cycle-safe.
fn insert_ancestor_closure(tx: &Transaction, parents: &HashMap<String, Vec<String>>) -> Result<()> {
    let mut ins = tx.prepare_cached("INSERT OR IGNORE INTO oracle_tag_ancestors (tag_id, ancestor_id, depth) VALUES (?1, ?2, ?3)")?;
    for tag in parents.keys() {
        let mut seen: HashSet<&str> = HashSet::new();
        let mut frontier: Vec<(&str, i64)> = vec![(tag.as_str(), 0)];
        while let Some((cur, depth)) = frontier.pop() {
            if !seen.insert(cur) {
                continue;
            }
            ins.execute(params![tag, cur, depth])?;
            if let Some(ps) = parents.get(cur) {
                for p in ps {
                    if parents.contains_key(p) {
                        frontier.push((p.as_str(), depth + 1));
                    }
                }
            }
        }
    }
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn ancestor_closure_includes_self_and_handles_cycles() {
        let conn = Connection::open_in_memory().unwrap();
        db::migrate(&conn).unwrap();
        let mut conn = conn;
        let tx = conn.transaction().unwrap();
        let mut parents = HashMap::new();
        parents.insert("a".to_string(), vec!["b".to_string()]);
        parents.insert("b".to_string(), vec!["c".to_string(), "a".to_string()]); // cycle a→b→a
        parents.insert("c".to_string(), vec![]);
        insert_ancestor_closure(&tx, &parents).unwrap();
        tx.commit().unwrap();
        let n: i64 = conn.query_row("SELECT COUNT(*) FROM oracle_tag_ancestors WHERE tag_id='a'", [], |r| r.get(0)).unwrap();
        assert_eq!(n, 3); // a, b, c
        let self_depth: i64 = conn
            .query_row("SELECT depth FROM oracle_tag_ancestors WHERE tag_id='c' AND ancestor_id='c'", [], |r| r.get(0))
            .unwrap();
        assert_eq!(self_depth, 0);
    }

    #[test]
    fn parses_sample_card_and_uses_face_oracle_id_fallback() {
        let sample = include_str!("../../../../knowledge/mtg-data-apis/scryfall/sample_card_exquisite-blood.json");
        let c: ScryCard = serde_json::from_str(sample).unwrap();
        assert_eq!(c.name, "Exquisite Blood");
        assert_eq!(c.effective_oracle_id(), Some("8f933fae-6c0c-42d7-a817-14760d8285cd"));
        assert!(c.display_images().unwrap().art_crop.is_some());
        assert_eq!(price(&c.prices, "usd"), Some(38.05));

        let reversible = r#"{"id":"x","name":"A // B","layout":"reversible_card","card_faces":[{"name":"A","oracle_id":"o-a"},{"name":"B","oracle_id":"o-b"}]}"#;
        let c: ScryCard = serde_json::from_str(reversible).unwrap();
        assert_eq!(c.effective_oracle_id(), Some("o-a"));
    }
}
