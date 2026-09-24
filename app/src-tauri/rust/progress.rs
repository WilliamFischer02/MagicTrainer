//! Progress reporting for long-running work (bulk download/import). The importer only
//! knows a `ProgressSink`; the Tauri layer forwards to a window event, the CLI prints.

use std::sync::Mutex;
use std::time::{Duration, Instant};

#[derive(Debug, Clone, serde::Serialize)]
#[serde(rename_all = "camelCase")]
pub struct Progress {
    /// Machine-readable stage id, e.g. "download:oracle_cards", "import:oracle_cards", "fts".
    pub stage: String,
    pub done: u64,
    /// Total units when known (bytes for downloads / compressed reads, rows otherwise).
    pub total: Option<u64>,
    pub message: String,
    pub finished: bool,
}

pub trait ProgressSink: Send + Sync {
    fn report(&self, p: Progress);
}

pub struct NoopSink;
impl ProgressSink for NoopSink {
    fn report(&self, _p: Progress) {}
}

pub struct StdoutSink;
impl ProgressSink for StdoutSink {
    fn report(&self, p: Progress) {
        match p.total {
            Some(t) if t > 0 => println!(
                "[{}] {:>5.1}% {}{}",
                p.stage,
                p.done as f64 * 100.0 / t as f64,
                p.message,
                if p.finished { " (done)" } else { "" }
            ),
            _ => println!("[{}] {} {}{}", p.stage, p.done, p.message, if p.finished { " (done)" } else { "" }),
        }
    }
}

/// Rate-limits reports for one stage to at most one per `interval`, always letting the
/// final (`finished`) report through.
pub struct Stage<'a> {
    sink: &'a dyn ProgressSink,
    stage: String,
    total: Option<u64>,
    last: Mutex<Option<Instant>>,
    interval: Duration,
}

impl<'a> Stage<'a> {
    pub fn new(sink: &'a dyn ProgressSink, stage: impl Into<String>, total: Option<u64>) -> Self {
        Self {
            sink,
            stage: stage.into(),
            total,
            last: Mutex::new(None),
            interval: Duration::from_millis(100),
        }
    }

    pub fn tick(&self, done: u64, message: impl Into<String>) {
        let mut last = self.last.lock().expect("progress mutex");
        let now = Instant::now();
        if let Some(l) = *last {
            if now.duration_since(l) < self.interval {
                return;
            }
        }
        *last = Some(now);
        self.sink.report(Progress {
            stage: self.stage.clone(),
            done,
            total: self.total,
            message: message.into(),
            finished: false,
        });
    }

    pub fn finish(&self, done: u64, message: impl Into<String>) {
        self.sink.report(Progress {
            stage: self.stage.clone(),
            done,
            total: self.total.or(Some(done)),
            message: message.into(),
            finished: true,
        });
    }
}
