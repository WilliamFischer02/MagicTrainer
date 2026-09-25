//! Commander Spellbook `find-my-combos` client with a 24 h on-disk cache (Q-013 default
//! online path; the bulk `variants.json.gz` import stays opt-in).
//!
//! Contract verified live 2026-09-24 (`knowledge/mtg-data-apis/commander-spellbook/
//! sample_find-my-combos_exquisite-blood.json`): `POST /find-my-combos` with
//! `{ main: [{card, quantity}], commanders: [{card, quantity}] }` answers
//! `{ results: { identity, included[], includedByChangingCommanders[], almostIncluded[],
//! almostIncludedByAddingColors[], almostIncludedByChangingCommanders[],
//! almostIncludedByAddingColorsAndChangingCommanders[] } }`, each item a variant in the
//! same shape as `/variants/` — reused from the bulk importer's `Variant` projection.
//!
//! Limits: ≤ 80 req/min, handle 429 (`spellbook_api.md`). Every result is cached under
//! `<cache dir>/spellbook/<sha256 of the canonical decklist>.json`; a stale cache is still
//! returned (flagged) when the network fails, so the app degrades to offline gracefully.

use std::path::PathBuf;
use std::time::{Duration, SystemTime, UNIX_EPOCH};

use serde::{Deserialize, Serialize};
use sha2::{Digest, Sha256};
use tauri::{AppHandle, Manager};

use crate::error::{msg, Error, Result};
use crate::import::spellbook::Variant;
use crate::net::{agent_with_timeout, retry_after_secs, RateLimiter};

pub const FIND_MY_COMBOS_URL: &str = "https://backend.commanderspellbook.com/find-my-combos";
pub const DEFAULT_TTL: Duration = Duration::from_secs(24 * 3600);

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
pub struct DeckCard {
    pub card: String,
    #[serde(default = "one")]
    pub quantity: i64,
}

fn one() -> i64 {
    1
}

#[derive(Debug, Clone, Default, Serialize, Deserialize)]
pub struct FindMyCombosRequest {
    #[serde(default)]
    pub main: Vec<DeckCard>,
    #[serde(default)]
    pub commanders: Vec<DeckCard>,
}

#[derive(Debug, Clone, Default, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct FindMyCombosResults {
    #[serde(default)]
    pub identity: String,
    #[serde(default)]
    pub included: Vec<Variant>,
    #[serde(default)]
    pub included_by_changing_commanders: Vec<Variant>,
    #[serde(default)]
    pub almost_included: Vec<Variant>,
    #[serde(default)]
    pub almost_included_by_adding_colors: Vec<Variant>,
    #[serde(default)]
    pub almost_included_by_changing_commanders: Vec<Variant>,
    #[serde(default)]
    pub almost_included_by_adding_colors_and_changing_commanders: Vec<Variant>,
}

#[derive(Debug, Deserialize)]
struct ApiResponse {
    results: FindMyCombosResults,
}

/// What is stored on disk and returned to the frontend.
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CombosEnvelope {
    pub key: String,
    /// RFC 3339 UTC.
    pub fetched_at: String,
    pub fetched_at_unix: u64,
    /// Served from disk without a network call.
    pub cached: bool,
    /// Older than the TTL (only possible when a refresh failed and we fell back).
    pub stale: bool,
    /// Why a refresh failed, when `stale` is true.
    pub warning: Option<String>,
    pub request: FindMyCombosRequest,
    pub results: FindMyCombosResults,
}

/// Canonical form: sections sorted, names trimmed, case preserved (Spellbook resolves names).
pub fn cache_key(req: &FindMyCombosRequest) -> String {
    fn lines(prefix: &str, cards: &[DeckCard]) -> Vec<String> {
        let mut v: Vec<String> = cards
            .iter()
            .map(|c| format!("{prefix}\t{}\t{}", c.card.trim(), c.quantity.max(1)))
            .collect();
        v.sort();
        v.dedup();
        v
    }
    let mut h = Sha256::new();
    for line in lines("c", &req.commanders).into_iter().chain(lines("m", &req.main)) {
        h.update(line.as_bytes());
        h.update(b"\n");
    }
    let digest = h.finalize();
    digest.iter().map(|b| format!("{b:02x}")).collect()
}

pub struct ComboClient {
    pub dir: PathBuf,
    limiter: RateLimiter,
    ttl: Duration,
}

fn now_unix() -> u64 {
    SystemTime::now().duration_since(UNIX_EPOCH).map(|d| d.as_secs()).unwrap_or(0)
}

impl ComboClient {
    pub fn new(dir: PathBuf) -> Self {
        Self { dir, limiter: RateLimiter::per_minute(80), ttl: DEFAULT_TTL }
    }

    pub fn with_ttl(mut self, ttl: Duration) -> Self {
        self.ttl = ttl;
        self
    }

    fn cache_path(&self, key: &str) -> PathBuf {
        self.dir.join(format!("{key}.json"))
    }

    fn read_cache(&self, key: &str) -> Option<CombosEnvelope> {
        let text = std::fs::read_to_string(self.cache_path(key)).ok()?;
        match serde_json::from_str::<CombosEnvelope>(&text) {
            Ok(env) if env.key == key => Some(env),
            Ok(_) => None,
            Err(e) => {
                eprintln!("spellbook cache: unreadable {key}.json ({e}); refetching");
                None
            }
        }
    }

    fn write_cache(&self, env: &CombosEnvelope) -> Result<()> {
        std::fs::create_dir_all(&self.dir)?;
        let path = self.cache_path(&env.key);
        let tmp = path.with_extension(format!("json.part{}", std::process::id()));
        std::fs::write(&tmp, serde_json::to_vec(env)?)?;
        std::fs::rename(&tmp, &path)?;
        Ok(())
    }

    fn is_fresh(&self, env: &CombosEnvelope) -> bool {
        now_unix().saturating_sub(env.fetched_at_unix) < self.ttl.as_secs()
    }

    /// Cache-first lookup. `fetch` performs the HTTP call (injected so tests never hit the network).
    pub fn find_my_combos_with(
        &self,
        req: &FindMyCombosRequest,
        force_refresh: bool,
        fetch: &dyn Fn(&FindMyCombosRequest) -> Result<FindMyCombosResults>,
    ) -> Result<CombosEnvelope> {
        let key = cache_key(req);
        let cached = self.read_cache(&key);
        if !force_refresh {
            if let Some(env) = cached.as_ref().filter(|e| self.is_fresh(e)) {
                return Ok(CombosEnvelope { cached: true, stale: false, warning: None, ..env.clone() });
            }
        }
        match fetch(req) {
            Ok(results) => {
                let env = CombosEnvelope {
                    key,
                    fetched_at: crate::db::now_iso(),
                    fetched_at_unix: now_unix(),
                    cached: false,
                    stale: false,
                    warning: None,
                    request: req.clone(),
                    results,
                };
                if let Err(e) = self.write_cache(&env) {
                    eprintln!("spellbook cache: could not write {}: {e}", self.cache_path(&env.key).display());
                }
                Ok(env)
            }
            Err(e) => match cached {
                Some(env) => Ok(CombosEnvelope { cached: true, stale: true, warning: Some(e.to_string()), ..env }),
                None => Err(e),
            },
        }
    }

    /// Cache-first lookup against the live API.
    pub fn find_my_combos(&self, req: &FindMyCombosRequest, force_refresh: bool) -> Result<CombosEnvelope> {
        self.find_my_combos_with(req, force_refresh, &|r| self.fetch_live(r))
    }

    fn fetch_live(&self, req: &FindMyCombosRequest) -> Result<FindMyCombosResults> {
        let body = serde_json::to_string(req)?;
        for attempt in 0..2 {
            self.limiter.acquire();
            let mut resp = agent_with_timeout(Duration::from_secs(60))
                .post(FIND_MY_COMBOS_URL)
                .header("Content-Type", "application/json")
                .header("Accept", "application/json")
                .send(body.as_bytes())?;
            let status = resp.status().as_u16();
            if status == 429 && attempt == 0 {
                let secs = retry_after_secs(resp.headers().get("retry-after").and_then(|v| v.to_str().ok())).unwrap_or(10).min(60);
                self.limiter.back_off(Duration::from_secs(secs));
                continue;
            }
            if status >= 400 {
                let text = resp.body_mut().read_to_string().unwrap_or_default();
                return Err(Error::Http(format!("POST find-my-combos → HTTP {status}: {}", text.chars().take(300).collect::<String>())));
            }
            let text = resp.body_mut().read_to_string()?;
            let parsed: ApiResponse = serde_json::from_str(&text)?;
            return Ok(parsed.results);
        }
        Err(Error::Http("POST find-my-combos → HTTP 429 twice; giving up".into()))
    }

    /// Cache housekeeping: number of files and bytes.
    pub fn status(&self) -> (u64, u64) {
        let Ok(rd) = std::fs::read_dir(&self.dir) else { return (0, 0) };
        let mut n = 0;
        let mut bytes = 0;
        for e in rd.flatten() {
            if let Ok(m) = e.metadata() {
                if m.is_file() {
                    n += 1;
                    bytes += m.len();
                }
            }
        }
        (n, bytes)
    }

    pub fn clear(&self) -> Result<u64> {
        let (_, bytes) = self.status();
        if self.dir.is_dir() {
            std::fs::remove_dir_all(&self.dir)?;
        }
        std::fs::create_dir_all(&self.dir)?;
        Ok(bytes)
    }
}

// ---- Tauri commands -------------------------------------------------------------------

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ComboCacheStatus {
    pub dir: String,
    pub files: u64,
    pub bytes: u64,
    pub ttl_hours: u64,
}

#[tauri::command]
pub async fn find_my_combos(
    app: AppHandle,
    main: Vec<DeckCard>,
    commanders: Option<Vec<DeckCard>>,
    force_refresh: Option<bool>,
) -> Result<CombosEnvelope> {
    let req = FindMyCombosRequest { main, commanders: commanders.unwrap_or_default() };
    if req.main.is_empty() && req.commanders.is_empty() {
        return Err(msg("find_my_combos: empty decklist"));
    }
    tauri::async_runtime::spawn_blocking(move || app.state::<ComboClient>().find_my_combos(&req, force_refresh.unwrap_or(false)))
        .await
        .map_err(|e| msg(format!("task panicked: {e}")))?
}

#[tauri::command]
pub fn combo_cache_status(client: tauri::State<'_, ComboClient>) -> ComboCacheStatus {
    let (files, bytes) = client.status();
    ComboCacheStatus { dir: client.dir.display().to_string(), files, bytes, ttl_hours: client.ttl.as_secs() / 3600 }
}

#[tauri::command]
pub fn combo_cache_clear(client: tauri::State<'_, ComboClient>) -> Result<u64> {
    client.clear()
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::cell::Cell;

    const SAMPLE: &str = include_str!("../../../knowledge/mtg-data-apis/commander-spellbook/sample_find-my-combos_exquisite-blood.json");

    fn req() -> FindMyCombosRequest {
        FindMyCombosRequest {
            main: vec![
                DeckCard { card: "Exquisite Blood".into(), quantity: 1 },
                DeckCard { card: "Sanguine Bond".into(), quantity: 1 },
                DeckCard { card: "Swamp".into(), quantity: 30 },
            ],
            commanders: vec![],
        }
    }

    fn sample_results() -> FindMyCombosResults {
        serde_json::from_str::<ApiResponse>(SAMPLE).unwrap().results
    }

    #[test]
    fn parses_the_live_sample() {
        let r = sample_results();
        assert_eq!(r.identity, "B");
        assert_eq!(r.included.len(), 1);
        assert_eq!(r.included[0].id, "690-3966");
        assert_eq!(r.included[0].uses.len(), 2);
        assert_eq!(r.included[0].uses[1].card.oracle_id.as_deref(), Some("8f933fae-6c0c-42d7-a817-14760d8285cd"));
        assert_eq!(r.almost_included.len(), 10);
        assert_eq!(r.almost_included_by_adding_colors.len(), 7);
        assert!(r.included[0].description.as_deref().unwrap_or("").starts_with("Gain life."));
    }

    #[test]
    fn cache_key_is_order_insensitive_and_section_sensitive() {
        let a = req();
        let mut b = req();
        b.main.reverse();
        assert_eq!(cache_key(&a), cache_key(&b));
        assert_eq!(cache_key(&a).len(), 64);
        let mut c = req();
        c.commanders.push(c.main.remove(0));
        assert_ne!(cache_key(&a), cache_key(&c));
        let mut d = req();
        d.main[2].quantity = 31;
        assert_ne!(cache_key(&a), cache_key(&d));
    }

    #[test]
    fn serves_from_cache_within_ttl_and_refetches_after() {
        let dir = std::env::temp_dir().join(format!("mt-sbapi-{}", std::process::id()));
        let _ = std::fs::remove_dir_all(&dir);
        let client = ComboClient::new(dir.clone());
        let calls = Cell::new(0);
        let fetch = |_: &FindMyCombosRequest| {
            calls.set(calls.get() + 1);
            Ok(sample_results())
        };
        let first = client.find_my_combos_with(&req(), false, &fetch).unwrap();
        assert!(!first.cached && !first.stale);
        assert_eq!(calls.get(), 1);
        let second = client.find_my_combos_with(&req(), false, &fetch).unwrap();
        assert!(second.cached && !second.stale);
        assert_eq!(second.results.included[0].id, "690-3966");
        assert_eq!(calls.get(), 1);
        let forced = client.find_my_combos_with(&req(), true, &fetch).unwrap();
        assert!(!forced.cached);
        assert_eq!(calls.get(), 2);

        // Expired → refetch.
        let short = ComboClient::new(dir.clone()).with_ttl(Duration::from_secs(0));
        let third = short.find_my_combos_with(&req(), false, &fetch).unwrap();
        assert!(!third.cached);
        assert_eq!(calls.get(), 3);
        let _ = std::fs::remove_dir_all(&dir);
    }

    #[test]
    fn falls_back_to_stale_cache_when_offline() {
        let dir = std::env::temp_dir().join(format!("mt-sbapi-stale-{}", std::process::id()));
        let _ = std::fs::remove_dir_all(&dir);
        let ok = |_: &FindMyCombosRequest| Ok(sample_results());
        let fail = |_: &FindMyCombosRequest| Err(Error::Http("offline".into()));
        ComboClient::new(dir.clone()).find_my_combos_with(&req(), false, &ok).unwrap();
        let short = ComboClient::new(dir.clone()).with_ttl(Duration::from_secs(0));
        let env = short.find_my_combos_with(&req(), false, &fail).unwrap();
        assert!(env.cached && env.stale);
        assert_eq!(env.warning.as_deref(), Some("http: offline"));
        // No cache at all → the error surfaces.
        let mut other = req();
        other.main.push(DeckCard { card: "Island".into(), quantity: 1 });
        assert!(short.find_my_combos_with(&other, false, &fail).is_err());
        let _ = std::fs::remove_dir_all(&dir);
    }
}
