//! Local diagnostics log (Q-011: local only, never uploaded). Rust panics and frontend
//! `window.onerror` / unhandled rejections land in `<data dir>/logs/magictrainer.log`,
//! rotated when it passes 2 MB. Nothing personal is written beyond what the app itself prints.

use std::io::Write;
use std::path::{Path, PathBuf};
use std::sync::Mutex;

use serde::{Deserialize, Serialize};
use tauri::{AppHandle, Manager, State};

use crate::error::{msg, Result};

const MAX_BYTES: u64 = 2 * 1024 * 1024;

pub struct AppLog {
    path: PathBuf,
    lock: Mutex<()>,
}

#[derive(Debug, Clone, Copy, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum Level {
    Info,
    Warn,
    Error,
}

impl AppLog {
    pub fn new(data_dir: &Path) -> Self {
        Self { path: data_dir.join("logs").join("magictrainer.log"), lock: Mutex::new(()) }
    }

    pub fn path(&self) -> &Path {
        &self.path
    }

    pub fn write(&self, level: Level, source: &str, message: &str) -> Result<()> {
        let _g = self.lock.lock().map_err(|_| msg("log mutex poisoned"))?;
        if let Some(parent) = self.path.parent() {
            std::fs::create_dir_all(parent)?;
        }
        if std::fs::metadata(&self.path).map(|m| m.len() > MAX_BYTES).unwrap_or(false) {
            let _ = std::fs::rename(&self.path, self.path.with_extension("log.1"));
        }
        let mut f = std::fs::OpenOptions::new().create(true).append(true).open(&self.path)?;
        let level = match level {
            Level::Info => "INFO",
            Level::Warn => "WARN",
            Level::Error => "ERROR",
        };
        let one_line = message.replace(['\r', '\n'], " ⏎ ");
        writeln!(f, "{} {level:5} [{source}] {one_line}", crate::db::now_iso())?;
        Ok(())
    }

    /// Last `max_lines` lines for the Settings screen.
    pub fn tail(&self, max_lines: usize) -> Result<Vec<String>> {
        let text = match std::fs::read_to_string(&self.path) {
            Ok(t) => t,
            Err(e) if e.kind() == std::io::ErrorKind::NotFound => return Ok(Vec::new()),
            Err(e) => return Err(e.into()),
        };
        let lines: Vec<&str> = text.lines().collect();
        let start = lines.len().saturating_sub(max_lines);
        Ok(lines[start..].iter().map(|s| s.to_string()).collect())
    }
}

/// Route Rust panics into the log (and still to stderr).
pub fn install_panic_hook(app: &AppHandle) {
    let handle = app.clone();
    let default = std::panic::take_hook();
    std::panic::set_hook(Box::new(move |info| {
        if let Some(log) = handle.try_state::<AppLog>() {
            let _ = log.write(Level::Error, "rust-panic", &info.to_string());
        }
        default(info);
    }));
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct LogStatus {
    pub path: String,
    pub bytes: u64,
    pub tail: Vec<String>,
}

#[tauri::command]
pub fn log_event(log: State<'_, AppLog>, level: Level, source: String, message: String) -> Result<()> {
    log.write(level, &source, &message)
}

#[tauri::command]
pub fn log_status(log: State<'_, AppLog>, lines: Option<usize>) -> Result<LogStatus> {
    let bytes = std::fs::metadata(log.path()).map(|m| m.len()).unwrap_or(0);
    Ok(LogStatus { path: log.path().display().to_string(), bytes, tail: log.tail(lines.unwrap_or(50))? })
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn writes_single_lines_and_tails() {
        let dir = std::env::temp_dir().join(format!("mt-log-{}", std::process::id()));
        let _ = std::fs::remove_dir_all(&dir);
        let log = AppLog::new(&dir);
        log.write(Level::Info, "test", "hello").unwrap();
        log.write(Level::Error, "test", "multi\nline").unwrap();
        let tail = log.tail(1).unwrap();
        assert_eq!(tail.len(), 1);
        assert!(tail[0].contains("ERROR [test] multi ⏎  line") || tail[0].contains("ERROR [test] multi ⏎ line"));
        assert_eq!(log.tail(10).unwrap().len(), 2);
        let _ = std::fs::remove_dir_all(&dir);
    }
}
