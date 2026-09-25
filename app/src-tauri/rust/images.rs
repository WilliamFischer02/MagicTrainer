//! Card-image disk cache served to the webview through the `mtimg` custom protocol.
//!
//! The frontend rewrites `https://cards.scryfall.io/<size>/<face>/<a>/<b>/<id>.<ext>?<ts>` to
//! `http://mtimg.localhost/<size>/<face>/<a>/<b>/<id>.<ext>?<ts>` (see `src/bridge/images.ts`).
//! This handler maps the path back to the Scryfall origin, serves the file from
//! `<cache dir>/images/<size>/<face>/<id>[-<ts>].<ext>` and downloads it on a miss —
//! gated by one shared limiter at 10 req/s (CLAUDE.md; Scryfall's file origin documents
//! no hard limit, `knowledge/mtg-data-apis/scryfall/api_rate-limits.md`) with the project
//! User-Agent. Only `cards.scryfall.io` paths of the known shape are accepted, so the
//! cache can never be pointed at an arbitrary host or path.

use std::collections::HashMap;
use std::io::Read;
use std::path::{Path, PathBuf};
use std::sync::atomic::{AtomicU64, Ordering};
use std::sync::Mutex;
use std::time::{Duration, Instant};

use serde::Serialize;
use tauri::http::{header, Response, StatusCode};
use tauri::{AppHandle, Manager, State, UriSchemeContext, UriSchemeResponder};

use crate::error::{msg, Error, Result};
use crate::net::{agent_with_timeout, retry_after_secs, RateLimiter};

pub const SCHEME: &str = "mtimg";
pub const SCRYFALL_IMAGE_ORIGIN: &str = "https://cards.scryfall.io";
const SIZES: [&str; 11] = ["small", "normal", "large", "png", "art_crop", "border_crop", "thumb", "grid", "display", "crop", "art"];
const FACES: [&str; 2] = ["front", "back"];
const EXTS: [(&str, &str); 3] = [("jpg", "image/jpeg"), ("png", "image/png"), ("webp", "image/webp")];

/// A validated Scryfall image reference.
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct ImageRef {
    pub size: String,
    pub face: String,
    pub id: String,
    pub ext: String,
    pub ts: Option<String>,
}

impl ImageRef {
    /// Parse `/<size>/<face>/<a>/<b>/<id>.<ext>` (+ optional `?<digits>` query).
    pub fn parse(path: &str, query: Option<&str>) -> Result<Self> {
        let segs: Vec<&str> = path.trim_start_matches('/').split('/').collect();
        let [size, face, a, b, file] = segs.as_slice() else {
            return Err(msg(format!("image path has {} segments, expected 5", segs.len())));
        };
        if !SIZES.contains(size) {
            return Err(msg(format!("unknown image size {size}")));
        }
        if !FACES.contains(face) {
            return Err(msg(format!("unknown image face {face}")));
        }
        let (id, ext) = file.rsplit_once('.').ok_or_else(|| msg("image file has no extension"))?;
        if !EXTS.iter().any(|(e, _)| e == &ext) {
            return Err(msg(format!("unsupported image extension {ext}")));
        }
        let uuid_ok = id.len() == 36
            && id.bytes().enumerate().all(|(i, c)| match i {
                8 | 13 | 18 | 23 => c == b'-',
                _ => c.is_ascii_hexdigit() && !c.is_ascii_uppercase(),
            });
        if !uuid_ok {
            return Err(msg(format!("image id is not a scryfall id: {id}")));
        }
        if !(a.len() == 1 && b.len() == 1 && id.starts_with(a) && id[1..].starts_with(b)) {
            return Err(msg("image shard directories do not match the id"));
        }
        let ts = match query.map(str::trim).filter(|q| !q.is_empty()) {
            None => None,
            Some(q) if q.len() <= 16 && q.bytes().all(|c| c.is_ascii_digit()) => Some(q.to_string()),
            Some(q) => return Err(msg(format!("unexpected image query {q}"))),
        };
        Ok(Self { size: size.to_string(), face: face.to_string(), id: id.to_string(), ext: ext.to_string(), ts })
    }

    /// Parse a full `https://cards.scryfall.io/...` URL.
    pub fn parse_url(url: &str) -> Result<Self> {
        let rest = url
            .strip_prefix(SCRYFALL_IMAGE_ORIGIN)
            .ok_or_else(|| msg(format!("not a cards.scryfall.io url: {url}")))?;
        let (path, query) = match rest.split_once('?') {
            Some((p, q)) => (p, Some(q)),
            None => (rest, None),
        };
        Self::parse(path, query)
    }

    pub fn remote_url(&self) -> String {
        let mut u = format!(
            "{SCRYFALL_IMAGE_ORIGIN}/{}/{}/{}/{}/{}.{}",
            self.size,
            self.face,
            &self.id[0..1],
            &self.id[1..2],
            self.id,
            self.ext
        );
        if let Some(ts) = &self.ts {
            u.push('?');
            u.push_str(ts);
        }
        u
    }

    /// Relative cache path. The timestamp is folded into the file name so an updated scan
    /// (new `?ts`) is fetched fresh instead of served stale.
    pub fn cache_rel_path(&self) -> PathBuf {
        let file = match &self.ts {
            Some(ts) => format!("{}-{}.{}", self.id, ts, self.ext),
            None => format!("{}.{}", self.id, self.ext),
        };
        PathBuf::from(&self.size).join(&self.face).join(file)
    }

    pub fn content_type(&self) -> &'static str {
        EXTS.iter().find(|(e, _)| e == &self.ext).map(|(_, m)| *m).unwrap_or("application/octet-stream")
    }
}

#[derive(Debug, Default)]
struct Counters {
    hits: AtomicU64,
    misses: AtomicU64,
    errors: AtomicU64,
}

/// Why a fetch failed, kept briefly so a broken image is not re-requested in a loop.
#[derive(Debug, Clone)]
struct Failure {
    status: u16,
    until: Instant,
}

pub struct ImageCache {
    pub dir: PathBuf,
    limiter: RateLimiter,
    failures: Mutex<HashMap<String, Failure>>,
    counters: Counters,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ImageCacheStatus {
    pub dir: String,
    pub files: u64,
    pub bytes: u64,
    pub hits: u64,
    pub misses: u64,
    pub errors: u64,
}

#[derive(Debug, Default, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct PrefetchReport {
    pub requested: usize,
    pub fetched: usize,
    pub already_cached: usize,
    pub failed: Vec<String>,
    pub seconds: f64,
}

/// Outcome of a lookup: the bytes plus whether the network was used.
pub struct Fetched {
    pub bytes: Vec<u8>,
    pub from_network: bool,
}

impl ImageCache {
    pub fn new(dir: PathBuf) -> Self {
        Self { dir, limiter: RateLimiter::per_second(10), failures: Mutex::new(HashMap::new()), counters: Counters::default() }
    }

    pub fn path_for(&self, r: &ImageRef) -> PathBuf {
        self.dir.join(r.cache_rel_path())
    }

    fn remembered_failure(&self, key: &str) -> Option<u16> {
        let mut map = self.failures.lock().expect("image failures mutex");
        match map.get(key) {
            Some(f) if f.until > Instant::now() => Some(f.status),
            Some(_) => {
                map.remove(key);
                None
            }
            None => None,
        }
    }

    fn remember_failure(&self, key: String, status: u16) {
        let ttl = match status {
            404 | 410 => Duration::from_secs(3600),
            429 => Duration::from_secs(30),
            _ => Duration::from_secs(60),
        };
        self.failures.lock().expect("image failures mutex").insert(key, Failure { status, until: Instant::now() + ttl });
    }

    /// Serve from disk, or download (rate-limited) and store. Errors carry an HTTP status
    /// so the protocol handler can echo something sensible to the webview.
    pub fn get(&self, r: &ImageRef) -> std::result::Result<Fetched, (u16, String)> {
        let path = self.path_for(r);
        if let Ok(bytes) = std::fs::read(&path) {
            if !bytes.is_empty() {
                self.counters.hits.fetch_add(1, Ordering::Relaxed);
                return Ok(Fetched { bytes, from_network: false });
            }
        }
        let url = r.remote_url();
        if let Some(status) = self.remembered_failure(&url) {
            return Err((status, format!("recent failure (HTTP {status}) for {url}")));
        }
        self.counters.misses.fetch_add(1, Ordering::Relaxed);
        match self.download(&url, &path) {
            Ok(bytes) => Ok(Fetched { bytes, from_network: true }),
            Err((status, text)) => {
                self.counters.errors.fetch_add(1, Ordering::Relaxed);
                self.remember_failure(url, status);
                Err((status, text))
            }
        }
    }

    fn download(&self, url: &str, dest: &Path) -> std::result::Result<Vec<u8>, (u16, String)> {
        self.limiter.acquire();
        let mut resp = agent_with_timeout(Duration::from_secs(30))
            .get(url)
            .call()
            .map_err(|e| (502, format!("GET {url}: {e}")))?;
        let status = resp.status().as_u16();
        if status == 429 {
            let secs = retry_after_secs(resp.headers().get(header::RETRY_AFTER).and_then(|v| v.to_str().ok())).unwrap_or(30);
            self.limiter.back_off(Duration::from_secs(secs.min(120)));
            return Err((429, format!("GET {url}: rate limited, backing off {secs}s")));
        }
        if status >= 400 {
            return Err((status, format!("GET {url}: HTTP {status}")));
        }
        let mut bytes = Vec::with_capacity(64 * 1024);
        resp.body_mut()
            .as_reader()
            .take(32 * 1024 * 1024)
            .read_to_end(&mut bytes)
            .map_err(|e| (502, format!("GET {url}: read: {e}")))?;
        if bytes.is_empty() {
            return Err((502, format!("GET {url}: empty body")));
        }
        if let Err(e) = write_atomic(dest, &bytes) {
            // Serving still works; caching failed. Surface it without failing the image.
            eprintln!("image cache: could not write {}: {e}", dest.display());
        }
        Ok(bytes)
    }

    pub fn status(&self) -> ImageCacheStatus {
        let (files, bytes) = dir_stats(&self.dir);
        ImageCacheStatus {
            dir: self.dir.display().to_string(),
            files,
            bytes,
            hits: self.counters.hits.load(Ordering::Relaxed),
            misses: self.counters.misses.load(Ordering::Relaxed),
            errors: self.counters.errors.load(Ordering::Relaxed),
        }
    }

    /// Delete every cached image. Returns bytes freed.
    pub fn clear(&self) -> Result<u64> {
        let (_, bytes) = dir_stats(&self.dir);
        if self.dir.is_dir() {
            std::fs::remove_dir_all(&self.dir)?;
        }
        std::fs::create_dir_all(&self.dir)?;
        self.failures.lock().expect("image failures mutex").clear();
        Ok(bytes)
    }
}

fn write_atomic(dest: &Path, bytes: &[u8]) -> std::io::Result<()> {
    if let Some(parent) = dest.parent() {
        std::fs::create_dir_all(parent)?;
    }
    let tmp = dest.with_extension(format!("{}.part{}", dest.extension().and_then(|e| e.to_str()).unwrap_or("bin"), std::process::id()));
    std::fs::write(&tmp, bytes)?;
    match std::fs::rename(&tmp, dest) {
        Ok(()) => Ok(()),
        Err(e) => {
            // A concurrent request may have won the race; that is fine if the file exists.
            let _ = std::fs::remove_file(&tmp);
            if dest.is_file() {
                Ok(())
            } else {
                Err(e)
            }
        }
    }
}

fn dir_stats(dir: &Path) -> (u64, u64) {
    fn walk(dir: &Path, files: &mut u64, bytes: &mut u64) {
        let Ok(rd) = std::fs::read_dir(dir) else { return };
        for entry in rd.flatten() {
            let Ok(meta) = entry.metadata() else { continue };
            if meta.is_dir() {
                walk(&entry.path(), files, bytes);
            } else {
                *files += 1;
                *bytes += meta.len();
            }
        }
    }
    let (mut f, mut b) = (0, 0);
    walk(dir, &mut f, &mut b);
    (f, b)
}

fn plain(status: StatusCode, text: String) -> Response<Vec<u8>> {
    Response::builder()
        .status(status)
        .header(header::CONTENT_TYPE, "text/plain; charset=utf-8")
        .header(header::CACHE_CONTROL, "no-store")
        .body(text.into_bytes())
        .expect("static response")
}

/// `mtimg` protocol handler. Registered in `lib.rs`; runs for every `<img src="http://mtimg.localhost/...">`.
pub fn handle_protocol<R: tauri::Runtime>(ctx: UriSchemeContext<'_, R>, request: tauri::http::Request<Vec<u8>>, responder: UriSchemeResponder) {
    let app = ctx.app_handle().clone();
    let uri = request.uri().clone();
    tauri::async_runtime::spawn_blocking(move || {
        let Some(cache) = app.try_state::<ImageCache>() else {
            responder.respond(plain(StatusCode::SERVICE_UNAVAILABLE, "image cache not ready".into()));
            return;
        };
        let r = match ImageRef::parse(uri.path(), uri.query()) {
            Ok(r) => r,
            Err(e) => {
                responder.respond(plain(StatusCode::BAD_REQUEST, e.to_string()));
                return;
            }
        };
        match cache.get(&r) {
            Ok(f) => {
                let resp = Response::builder()
                    .status(StatusCode::OK)
                    .header(header::CONTENT_TYPE, r.content_type())
                    .header(header::CONTENT_LENGTH, f.bytes.len())
                    .header(header::CACHE_CONTROL, "public, max-age=31536000, immutable")
                    // Public card art; lets `fetch()`-based prefetch/diagnostics read it cross-origin.
                    .header(header::ACCESS_CONTROL_ALLOW_ORIGIN, "*")
                    .header("X-MagicTrainer-Cache", if f.from_network { "miss" } else { "hit" })
                    .body(f.bytes)
                    .expect("image response");
                responder.respond(resp);
            }
            Err((status, text)) => {
                let code = StatusCode::from_u16(status).unwrap_or(StatusCode::BAD_GATEWAY);
                responder.respond(plain(code, text));
            }
        }
    });
}

// ---- Tauri commands -------------------------------------------------------------------

#[tauri::command]
pub fn image_cache_status(cache: State<'_, ImageCache>) -> ImageCacheStatus {
    cache.status()
}

#[tauri::command]
pub async fn image_cache_clear(app: AppHandle) -> Result<u64> {
    tauri::async_runtime::spawn_blocking(move || app.state::<ImageCache>().clear())
        .await
        .map_err(|e| msg(format!("task panicked: {e}")))?
}

/// Warm the cache for a list of Scryfall image URLs (e.g. every card of a freshly imported deck).
/// Sequential through the shared limiter; never fails the whole batch for one bad URL.
#[tauri::command]
pub async fn image_prefetch(app: AppHandle, urls: Vec<String>) -> Result<PrefetchReport> {
    tauri::async_runtime::spawn_blocking(move || {
        let cache = app.state::<ImageCache>();
        let started = Instant::now();
        let mut report = PrefetchReport { requested: urls.len(), ..Default::default() };
        for url in urls {
            let r = match ImageRef::parse_url(&url) {
                Ok(r) => r,
                Err(e) => {
                    report.failed.push(format!("{url}: {e}"));
                    continue;
                }
            };
            if cache.path_for(&r).is_file() {
                report.already_cached += 1;
                continue;
            }
            match cache.get(&r) {
                Ok(_) => report.fetched += 1,
                Err((_, text)) => report.failed.push(text),
            }
        }
        report.seconds = started.elapsed().as_secs_f64();
        Ok::<_, Error>(report)
    })
    .await
    .map_err(|e| msg(format!("task panicked: {e}")))?
}

#[cfg(test)]
mod tests {
    use super::*;

    const URL: &str = "https://cards.scryfall.io/art_crop/front/a/d/ad4de9f1-7a39-45af-828e-c59234d9e9b9.jpg?1783927550";

    #[test]
    fn parses_scryfall_image_url_and_round_trips() {
        let r = ImageRef::parse_url(URL).unwrap();
        assert_eq!(r.size, "art_crop");
        assert_eq!(r.face, "front");
        assert_eq!(r.id, "ad4de9f1-7a39-45af-828e-c59234d9e9b9");
        assert_eq!(r.ext, "jpg");
        assert_eq!(r.ts.as_deref(), Some("1783927550"));
        assert_eq!(r.remote_url(), URL);
        assert_eq!(r.content_type(), "image/jpeg");
        assert_eq!(
            r.cache_rel_path(),
            PathBuf::from("art_crop").join("front").join("ad4de9f1-7a39-45af-828e-c59234d9e9b9-1783927550.jpg")
        );
    }

    #[test]
    fn parses_protocol_path_without_query() {
        let r = ImageRef::parse("/png/back/0/e/0e8ccfa7-4178-476a-a155-0ca1c98556c9.png", None).unwrap();
        assert_eq!(r.ts, None);
        assert_eq!(r.content_type(), "image/png");
        assert_eq!(r.remote_url(), "https://cards.scryfall.io/png/back/0/e/0e8ccfa7-4178-476a-a155-0ca1c98556c9.png");
    }

    #[test]
    fn rejects_unsafe_or_foreign_paths() {
        for bad in [
            "/art_crop/front/a/d/../../etc/passwd",
            "/art_crop/front/a/d/ad4de9f1-7a39-45af-828e-c59234d9e9b9.exe",
            "/huge/front/a/d/ad4de9f1-7a39-45af-828e-c59234d9e9b9.jpg",
            "/art_crop/side/a/d/ad4de9f1-7a39-45af-828e-c59234d9e9b9.jpg",
            "/art_crop/front/x/d/ad4de9f1-7a39-45af-828e-c59234d9e9b9.jpg",
            "/art_crop/front/a/d/AD4DE9F1-7A39-45AF-828E-C59234D9E9B9.jpg",
            "/art_crop/front/a/d/ad4de9f1.jpg",
        ] {
            assert!(ImageRef::parse(bad, None).is_err(), "{bad} should be rejected");
        }
        assert!(ImageRef::parse("/art_crop/front/a/d/ad4de9f1-7a39-45af-828e-c59234d9e9b9.jpg", Some("../x")).is_err());
        assert!(ImageRef::parse_url("https://evil.example/art_crop/front/a/d/ad4de9f1-7a39-45af-828e-c59234d9e9b9.jpg").is_err());
    }

    #[test]
    fn cache_hit_skips_network_and_counts() {
        let dir = std::env::temp_dir().join(format!("mt-img-{}", std::process::id()));
        let cache = ImageCache::new(dir.clone());
        let r = ImageRef::parse_url(URL).unwrap();
        let path = cache.path_for(&r);
        write_atomic(&path, b"jpegbytes").unwrap();
        let f = cache.get(&r).unwrap();
        assert!(!f.from_network);
        assert_eq!(f.bytes, b"jpegbytes");
        let st = cache.status();
        assert_eq!((st.hits, st.misses, st.files, st.bytes), (1, 0, 1, 9));
        assert_eq!(cache.clear().unwrap(), 9);
        assert!(!path.exists());
        let _ = std::fs::remove_dir_all(&dir);
    }

    #[test]
    fn remembered_failures_short_circuit() {
        let dir = std::env::temp_dir().join(format!("mt-img-fail-{}", std::process::id()));
        let cache = ImageCache::new(dir.clone());
        cache.remember_failure("u".into(), 404);
        assert_eq!(cache.remembered_failure("u"), Some(404));
        cache.failures.lock().unwrap().get_mut("u").unwrap().until = Instant::now() - Duration::from_secs(1);
        assert_eq!(cache.remembered_failure("u"), None);
        let _ = std::fs::remove_dir_all(&dir);
    }
}
