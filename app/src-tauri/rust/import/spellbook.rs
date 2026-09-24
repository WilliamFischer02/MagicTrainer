//! Commander Spellbook `variants.json.gz` importer.
//!
//! The file is ONE JSON document `{ timestamp, version, variants: [...], aliases: [...] }` and
//! is large (600+ MB gzipped as of 2026-09-24), so it is parsed with a custom serde visitor
//! that inserts each variant as it is decoded instead of materializing the array.
//! Only `status == "OK"` variants are stored; a trimmed JSON projection goes in
//! `spellbook_variants.json` for the UI (steps, prerequisites, zones).

use std::cell::RefCell;
use std::fmt;
use std::marker::PhantomData;
use std::path::Path;
use std::sync::atomic::Ordering;

use rusqlite::{params, Connection, Transaction};
use serde::de::{DeserializeSeed, Deserializer, IgnoredAny, MapAccess, SeqAccess, Visitor};
use serde::{Deserialize, Serialize};

use super::{open_gz_reader, with_bulk_tx, Stats};
use crate::db;
use crate::error::Result;
use crate::progress::{ProgressSink, Stage};

#[derive(Debug, Default, Deserialize, Serialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct VariantCard {
    #[serde(default)]
    pub id: Option<i64>,
    pub name: String,
    #[serde(default)]
    pub oracle_id: Option<String>,
    #[serde(default)]
    pub type_line: Option<String>,
}

#[derive(Debug, Default, Deserialize, Serialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct CardUse {
    pub card: VariantCard,
    #[serde(default = "one")]
    pub quantity: i64,
    #[serde(default)]
    pub zone_locations: Vec<String>,
    #[serde(default)]
    pub must_be_commander: bool,
    #[serde(default)]
    pub battlefield_card_state: String,
    #[serde(default)]
    pub exile_card_state: String,
    #[serde(default)]
    pub graveyard_card_state: String,
    #[serde(default)]
    pub library_card_state: String,
}

#[derive(Debug, Default, Deserialize, Serialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct TemplateRef {
    #[serde(default)]
    pub name: String,
    #[serde(default)]
    pub scryfall_query: Option<String>,
}

#[derive(Debug, Default, Deserialize, Serialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct TemplateUse {
    pub template: TemplateRef,
    #[serde(default = "one")]
    pub quantity: i64,
    #[serde(default)]
    pub zone_locations: Vec<String>,
}

#[derive(Debug, Default, Deserialize, Serialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct FeatureRef {
    #[serde(default)]
    pub id: Option<i64>,
    #[serde(default)]
    pub name: String,
    #[serde(default)]
    pub uncountable: bool,
}

#[derive(Debug, Default, Deserialize, Serialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct Produces {
    pub feature: FeatureRef,
    #[serde(default)]
    pub quantity: Option<i64>,
}

#[derive(Debug, Default, Deserialize, Serialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct Legalities {
    #[serde(default)]
    pub commander: bool,
    #[serde(default)]
    pub brawl: bool,
    #[serde(default)]
    pub modern: bool,
    #[serde(default)]
    pub legacy: bool,
    #[serde(default)]
    pub vintage: bool,
    #[serde(default)]
    pub pioneer: bool,
    #[serde(default)]
    pub standard: bool,
    #[serde(default)]
    pub pauper: bool,
}

/// The projection we keep. Serialized back to JSON for the `json` column.
#[derive(Debug, Default, Deserialize, Serialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct Variant {
    pub id: String,
    #[serde(default)]
    pub status: String,
    #[serde(default)]
    pub identity: String,
    #[serde(default)]
    pub uses: Vec<CardUse>,
    #[serde(default)]
    pub requires: Vec<TemplateUse>,
    #[serde(default)]
    pub produces: Vec<Produces>,
    #[serde(default)]
    pub legalities: Legalities,
    #[serde(default)]
    pub popularity: Option<i64>,
    #[serde(default)]
    pub bracket_tag: Option<String>,
    #[serde(default)]
    pub mana_needed: Option<String>,
    #[serde(default)]
    pub mana_value_needed: Option<i64>,
    #[serde(default)]
    pub description: Option<String>,
    #[serde(default)]
    pub easy_prerequisites: Option<String>,
    #[serde(default)]
    pub notable_prerequisites: Option<String>,
    #[serde(default)]
    pub notes: Option<String>,
    #[serde(default)]
    pub spoiler: bool,
}

fn one() -> i64 {
    1
}

struct Ctx<'a> {
    tx: &'a Transaction<'a>,
    stats: Stats,
    stage: &'a Stage<'a>,
    read: &'a std::sync::atomic::AtomicU64,
    err: Option<crate::error::Error>,
}

impl Ctx<'_> {
    fn insert(&mut self, v: Variant) -> Result<()> {
        if v.status != "OK" || v.spoiler {
            self.stats.ignored += 1;
            return Ok(());
        }
        let produces: Vec<&str> = v.produces.iter().map(|p| p.feature.name.as_str()).collect();
        let prereqs = [v.easy_prerequisites.as_deref(), v.notable_prerequisites.as_deref()]
            .into_iter()
            .flatten()
            .filter(|s| !s.trim().is_empty())
            .collect::<Vec<_>>()
            .join("\n");
        let mut ins = self.tx.prepare_cached(
            "INSERT OR REPLACE INTO spellbook_variants (
               id, status, identity, card_count, popularity, bracket_tag, mana_needed, mana_value,
               description, prerequisites, produces, legal_commander, json
             ) VALUES (?1,?2,?3,?4,?5,?6,?7,?8,?9,?10,?11,?12,?13)",
        )?;
        ins.execute(params![
            v.id,
            v.status,
            v.identity,
            v.uses.len() as i64,
            v.popularity,
            v.bracket_tag,
            v.mana_needed,
            v.mana_value_needed,
            v.description,
            if prereqs.is_empty() { None } else { Some(prereqs) },
            serde_json::to_string(&produces)?,
            v.legalities.commander as i64,
            serde_json::to_string(&v)?,
        ])?;
        let mut ins_card = self.tx.prepare_cached(
            "INSERT OR REPLACE INTO spellbook_variant_cards (variant_id, oracle_id, card_name, quantity, zone_locations, must_be_commander)
             VALUES (?1, ?2, ?3, ?4, ?5, ?6)",
        )?;
        for u in &v.uses {
            let Some(oid) = &u.card.oracle_id else { continue };
            ins_card.execute(params![
                v.id,
                oid,
                u.card.name,
                u.quantity,
                serde_json::to_string(&u.zone_locations)?,
                u.must_be_commander as i64,
            ])?;
        }
        self.stats.rows += 1;
        if self.stats.rows.is_multiple_of(1000) {
            self.stage.tick(self.read.load(Ordering::Relaxed), format!("{} variants", self.stats.rows));
        }
        Ok(())
    }
}

/// Deserializes the `variants` array element by element into the DB.
struct VariantsSeed<'a, 'b>(&'b RefCell<Ctx<'a>>);

impl<'de> DeserializeSeed<'de> for VariantsSeed<'_, '_> {
    type Value = ();
    fn deserialize<D: Deserializer<'de>>(self, d: D) -> std::result::Result<(), D::Error> {
        struct V<'a, 'b>(&'b RefCell<Ctx<'a>>);
        impl<'de> Visitor<'de> for V<'_, '_> {
            type Value = ();
            fn expecting(&self, f: &mut fmt::Formatter) -> fmt::Result {
                f.write_str("an array of variants")
            }
            fn visit_seq<A: SeqAccess<'de>>(self, mut seq: A) -> std::result::Result<(), A::Error> {
                while let Some(v) = seq.next_element::<Variant>()? {
                    let mut ctx = self.0.borrow_mut();
                    if ctx.err.is_some() {
                        continue; // drain the rest cheaply; error surfaces after parsing
                    }
                    if let Err(e) = ctx.insert(v) {
                        ctx.err = Some(e);
                    }
                }
                Ok(())
            }
        }
        d.deserialize_seq(V(self.0))
    }
}

/// Deserializes the top-level document, dispatching `variants` to `VariantsSeed` and
/// ignoring everything else except `timestamp`/`version` (kept for `meta`).
struct DocSeed<'a, 'b>(&'b RefCell<Ctx<'a>>, PhantomData<&'a ()>);

#[derive(Default)]
struct DocInfo {
    timestamp: Option<String>,
    version: Option<String>,
}

impl<'de> DeserializeSeed<'de> for DocSeed<'_, '_> {
    type Value = DocInfo;
    fn deserialize<D: Deserializer<'de>>(self, d: D) -> std::result::Result<DocInfo, D::Error> {
        struct V<'a, 'b>(&'b RefCell<Ctx<'a>>);
        impl<'de> Visitor<'de> for V<'_, '_> {
            type Value = DocInfo;
            fn expecting(&self, f: &mut fmt::Formatter) -> fmt::Result {
                f.write_str("the spellbook variants document")
            }
            fn visit_map<A: MapAccess<'de>>(self, mut map: A) -> std::result::Result<DocInfo, A::Error> {
                let mut info = DocInfo::default();
                while let Some(key) = map.next_key::<String>()? {
                    match key.as_str() {
                        "variants" => map.next_value_seed(VariantsSeed(self.0))?,
                        "timestamp" => info.timestamp = map.next_value::<Option<String>>()?,
                        "version" => info.version = map.next_value::<Option<String>>()?,
                        _ => {
                            map.next_value::<IgnoredAny>()?;
                        }
                    }
                }
                Ok(info)
            }
        }
        d.deserialize_map(V(self.0))
    }
}

pub fn import_variants(conn: &mut Connection, path: &Path, sink: &dyn ProgressSink) -> Result<Stats> {
    let (reader, read, total) = open_gz_reader(path)?;
    let stage = Stage::new(sink, "import:spellbook", Some(total));
    let (stats, info) = with_bulk_tx(conn, |tx| {
        tx.execute_batch("DELETE FROM spellbook_variants; DELETE FROM spellbook_variant_cards;")?;
        let ctx = RefCell::new(Ctx { tx, stats: Stats::default(), stage: &stage, read: &read, err: None });
        let mut de = serde_json::Deserializer::from_reader(reader);
        let info = DocSeed(&ctx, PhantomData).deserialize(&mut de)?;
        de.end()?;
        let ctx = ctx.into_inner();
        if let Some(e) = ctx.err {
            return Err(e);
        }
        Ok((ctx.stats, info))
    })?;
    if let Some(ts) = info.timestamp {
        db::meta_set(conn, "spellbook.timestamp", &ts)?;
    }
    if let Some(v) = info.version {
        db::meta_set(conn, "spellbook.version", &v)?;
    }
    stage.finish(total, format!("{} variants ({} ignored)", stats.rows, stats.ignored));
    Ok(stats)
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::progress::NoopSink;
    use flate2::write::GzEncoder;
    use flate2::Compression;
    use std::io::Write;

    #[test]
    fn streams_variants_from_a_gz_document() {
        // Build a tiny document from the bundled sample variant (paged API shape → bulk shape).
        let sample = include_str!("../../../../knowledge/mtg-data-apis/commander-spellbook/sample_variant_exquisite-blood.json");
        let page: serde_json::Value = serde_json::from_str(sample).unwrap();
        let variant = page["results"][0].clone();
        let mut draft = variant.clone();
        draft["id"] = serde_json::Value::String("draft-1".into());
        draft["status"] = serde_json::Value::String("D".into());
        let doc = serde_json::json!({
            "timestamp": "2026-09-24T00:00:00Z",
            "version": "test",
            "aliases": [{ "id": "x", "variant": "690-3966" }],
            "variants": [variant, draft],
        });
        let dir = std::env::temp_dir().join(format!("mt-sb-{}", std::process::id()));
        std::fs::create_dir_all(&dir).unwrap();
        let gz_path = dir.join("variants.json.gz");
        let mut enc = GzEncoder::new(std::fs::File::create(&gz_path).unwrap(), Compression::fast());
        enc.write_all(doc.to_string().as_bytes()).unwrap();
        enc.finish().unwrap();

        let db_path = dir.join("t.sqlite");
        let mut conn = db::open_rw(&db_path).unwrap();
        let stats = import_variants(&mut conn, &gz_path, &NoopSink).unwrap();
        assert_eq!(stats.rows, 1);
        assert_eq!(stats.ignored, 1);
        let (cards, produces, desc): (i64, String, String) = conn
            .query_row(
                "SELECT card_count, produces, description FROM spellbook_variants WHERE id = '690-3966'",
                [],
                |r| Ok((r.get(0)?, r.get(1)?, r.get(2)?)),
            )
            .unwrap();
        assert_eq!(cards, 2);
        assert!(produces.contains("Infinite lifeloss"));
        assert!(desc.starts_with("Gain life."));
        let n: i64 = conn
            .query_row("SELECT COUNT(*) FROM spellbook_variant_cards WHERE oracle_id = '8f933fae-6c0c-42d7-a817-14760d8285cd'", [], |r| r.get(0))
            .unwrap();
        assert_eq!(n, 1);
        assert_eq!(db::meta_get(&conn, "spellbook.version").unwrap().as_deref(), Some("test"));
        drop(conn);
        let _ = std::fs::remove_dir_all(&dir);
    }
}
