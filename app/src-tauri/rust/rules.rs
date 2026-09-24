//! Comprehensive Rules viewer backend. Loads the bundled CR section files
//! (`knowledge/mtg-rules/CR-S*_*.txt` + glossary, shipped as Tauri resources) into an
//! in-memory index once, then answers rule-number lookups ("603.6c", "704.5") and keyword
//! searches. No regex crate: the CR line grammar is simple enough to parse by hand.

use std::path::{Path, PathBuf};
use std::sync::{Arc, Mutex};

use serde::Serialize;
use tauri::{AppHandle, Manager, State};

use crate::error::{msg, Result};

#[derive(Debug, Clone, Serialize, PartialEq, Eq)]
#[serde(rename_all = "snake_case")]
pub enum RuleKind {
    /// "601. Casting Spells" / "6. Spells, Abilities, and Effects"
    Heading,
    /// "601.2a …"
    Rule,
    /// Glossary term + definition
    Glossary,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct RuleEntry {
    /// "603.6c", "601", "6" — or the glossary term.
    pub number: String,
    pub text: String,
    /// Section label from the file header, e.g. "6. Spells, Abilities, and Effects".
    pub section: String,
    pub kind: RuleKind,
}

#[derive(Debug, Default)]
pub struct RulesIndex {
    pub entries: Vec<RuleEntry>,
    pub effective: Option<String>,
    pub dir: PathBuf,
    lower: Vec<String>,
}

impl RulesIndex {
    pub fn load(dir: &Path) -> Result<Self> {
        let mut files: Vec<PathBuf> = std::fs::read_dir(dir)?
            .filter_map(|e| e.ok().map(|e| e.path()))
            .filter(|p| {
                let name = p.file_name().and_then(|n| n.to_str()).unwrap_or("");
                name.starts_with("CR-") && name.ends_with(".txt") && !name.starts_with("CR_")
            })
            .collect();
        files.sort();
        if files.is_empty() {
            return Err(msg(format!("no CR-*.txt files in {}", dir.display())));
        }
        let mut idx = RulesIndex { dir: dir.to_path_buf(), ..Default::default() };
        for f in files {
            let text = std::fs::read_to_string(&f)?;
            let is_glossary = f.file_name().and_then(|n| n.to_str()).is_some_and(|n| n.contains("GLOSSARY"));
            idx.parse_file(&text, is_glossary);
        }
        idx.lower = idx.entries.iter().map(|e| format!("{} {}", e.number, e.text).to_lowercase()).collect();
        Ok(idx)
    }

    fn parse_file(&mut self, text: &str, glossary: bool) {
        let mut section = String::new();
        let mut lines = text.lines().peekable();
        // Header: "[… — effective June 19, 2026]" then "[Section: …]".
        while let Some(l) = lines.peek() {
            let l = l.trim();
            if l.starts_with('[') && l.ends_with(']') {
                if let Some(i) = l.find("effective ") {
                    self.effective.get_or_insert_with(|| l[i + "effective ".len()..l.len() - 1].trim().to_string());
                }
                if let Some(rest) = l.strip_prefix("[Section: ") {
                    section = rest.trim_end_matches(']').trim().to_string();
                }
                lines.next();
            } else {
                break;
            }
        }
        if glossary {
            let mut block: Vec<&str> = Vec::new();
            let flush = |block: &mut Vec<&str>, entries: &mut Vec<RuleEntry>| {
                if block.len() >= 2 {
                    entries.push(RuleEntry {
                        number: block[0].trim().to_string(),
                        text: block[1..].join("\n").trim().to_string(),
                        section: "Glossary".to_string(),
                        kind: RuleKind::Glossary,
                    });
                }
                block.clear();
            };
            for l in lines {
                if l.trim().is_empty() {
                    flush(&mut block, &mut self.entries);
                } else if l.trim() != "Glossary" {
                    block.push(l);
                }
            }
            flush(&mut block, &mut self.entries);
            return;
        }
        for l in lines {
            let l = l.trim();
            if l.is_empty() {
                continue;
            }
            if let Some((number, rest)) = split_rule_number(l) {
                let kind = if number.contains('.') { RuleKind::Rule } else { RuleKind::Heading };
                self.entries.push(RuleEntry { number, text: rest.trim().to_string(), section: section.clone(), kind });
            }
        }
    }

    /// Exact rule number (case-insensitive on the trailing letter).
    pub fn get(&self, number: &str) -> Option<&RuleEntry> {
        let n = number.trim().trim_end_matches('.').to_lowercase();
        self.entries.iter().find(|e| e.kind != RuleKind::Glossary && e.number.to_lowercase() == n)
    }

    /// Rule-number prefix ("603.6" → 603.6, 603.6a…) or keyword search (all terms must appear).
    pub fn search(&self, query: &str, limit: usize) -> Vec<RuleEntry> {
        let q = query.trim();
        if q.is_empty() {
            return Vec::new();
        }
        if looks_like_rule_number(q) {
            let n = q.trim_end_matches('.').to_lowercase();
            let mut hits: Vec<&RuleEntry> = self
                .entries
                .iter()
                .filter(|e| e.kind != RuleKind::Glossary)
                .filter(|e| {
                    let en = e.number.to_lowercase();
                    en == n || en.starts_with(&format!("{n}.")) || (n.contains('.') && en.starts_with(&n))
                })
                .collect();
            hits.sort_by_key(|e| rule_sort_key(&e.number));
            return hits.into_iter().take(limit).cloned().collect();
        }
        let terms: Vec<String> = q.split_whitespace().map(|t| t.to_lowercase()).collect();
        let q_lower = q.to_lowercase();
        // An entry whose number/term IS the query (glossary "Activated Ability") always leads.
        let exact: Vec<RuleEntry> = self.entries.iter().filter(|e| e.number.to_lowercase() == q_lower).cloned().collect();
        let mut scored: Vec<(usize, usize)> = self
            .lower
            .iter()
            .enumerate()
            .filter_map(|(i, text)| {
                if terms.iter().all(|t| text.contains(t.as_str())) {
                    let score: usize = terms.iter().map(|t| text.matches(t.as_str()).count()).sum();
                    Some((i, score))
                } else {
                    None
                }
            })
            .collect();
        // More hits first; glossary/headings before deep sub-rules on ties; then shorter text.
        scored.sort_by(|(ia, sa), (ib, sb)| {
            sb.cmp(sa)
                .then_with(|| kind_rank(&self.entries[*ia].kind).cmp(&kind_rank(&self.entries[*ib].kind)))
                .then_with(|| self.entries[*ia].text.len().cmp(&self.entries[*ib].text.len()))
        });
        let mut out = exact;
        for (i, _) in scored {
            if out.len() >= limit {
                break;
            }
            let e = &self.entries[i];
            if !out.iter().any(|x| x.number == e.number && x.kind == e.kind) {
                out.push(e.clone());
            }
        }
        out.truncate(limit);
        out
    }
}

fn kind_rank(k: &RuleKind) -> u8 {
    match k {
        RuleKind::Glossary => 0,
        RuleKind::Heading => 1,
        RuleKind::Rule => 2,
    }
}

/// "603.6c Leaves-the-battlefield…" → ("603.6c", "Leaves…"); "601. Casting Spells" → ("601", "Casting Spells");
/// "6. Spells…" → ("6", …). Anything else → None.
fn split_rule_number(line: &str) -> Option<(String, &str)> {
    let bytes = line.as_bytes();
    let mut i = 0;
    while i < bytes.len() && bytes[i].is_ascii_digit() {
        i += 1;
    }
    if i == 0 || i > 3 {
        return None;
    }
    let mut j = i;
    if j < bytes.len() && bytes[j] == b'.' {
        j += 1;
        let k = j;
        while j < bytes.len() && bytes[j].is_ascii_digit() {
            j += 1;
        }
        if j == k {
            // "601. Casting Spells" (heading): number is "601", rest after ". "
            let rest = line[j..].trim_start();
            return Some((line[..i].to_string(), rest));
        }
        if j < bytes.len() && bytes[j].is_ascii_lowercase() {
            j += 1;
        }
        // Rule: "603.6c Text" or "603.6. Text" (older style)
        let mut end = j;
        if end < bytes.len() && bytes[end] == b'.' {
            end += 1;
        }
        if end < bytes.len() && bytes[end] != b' ' {
            return None;
        }
        return Some((line[..j].to_string(), line[end..].trim_start()));
    }
    None
}

fn looks_like_rule_number(q: &str) -> bool {
    let q = q.trim_end_matches('.');
    let mut parts = q.splitn(2, '.');
    let head = parts.next().unwrap_or("");
    if head.is_empty() || head.len() > 3 || !head.chars().all(|c| c.is_ascii_digit()) {
        return false;
    }
    match parts.next() {
        None => true,
        Some(tail) => {
            let digits = tail.trim_end_matches(|c: char| c.is_ascii_alphabetic());
            !digits.is_empty() && digits.chars().all(|c| c.is_ascii_digit()) && tail.len() - digits.len() <= 1
        }
    }
}

/// ("603.10a") → (603, 10, 'a') so 603.2 sorts before 603.10.
fn rule_sort_key(number: &str) -> (u32, u32, char) {
    let mut parts = number.splitn(2, '.');
    let a = parts.next().and_then(|s| s.parse().ok()).unwrap_or(0);
    let tail = parts.next().unwrap_or("");
    let digits: String = tail.chars().take_while(|c| c.is_ascii_digit()).collect();
    let b = digits.parse().unwrap_or(0);
    let c = tail.chars().find(|c| c.is_ascii_alphabetic()).unwrap_or(' ');
    (a, b, c)
}

// ---------- Tauri surface ----------

#[derive(Default)]
pub struct RulesState(Mutex<Option<Arc<RulesIndex>>>);

/// Locate the rules directory: env override → bundled resources → repo checkout (dev).
pub fn resolve_rules_dir(app: &AppHandle) -> Option<PathBuf> {
    if let Some(p) = std::env::var_os("MAGICTRAINER_RULES_DIR") {
        return Some(PathBuf::from(p));
    }
    if let Ok(res) = app.path().resource_dir() {
        let p = res.join("knowledge").join("mtg-rules");
        if p.is_dir() {
            return Some(p);
        }
    }
    let mut cur = std::env::current_dir().ok()?;
    for _ in 0..5 {
        let p = cur.join("knowledge").join("mtg-rules");
        if p.is_dir() {
            return Some(p);
        }
        cur = cur.parent()?.to_path_buf();
    }
    None
}

fn index(app: &AppHandle, state: &RulesState) -> Result<Arc<RulesIndex>> {
    let mut guard = state.0.lock().map_err(|_| msg("rules index poisoned"))?;
    if let Some(i) = guard.as_ref() {
        return Ok(i.clone());
    }
    let dir = resolve_rules_dir(app).ok_or_else(|| msg("Comprehensive Rules files not found (knowledge/mtg-rules)"))?;
    let idx = Arc::new(RulesIndex::load(&dir)?);
    *guard = Some(idx.clone());
    Ok(idx)
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct RulesStatus {
    pub dir: String,
    pub entries: usize,
    pub effective: Option<String>,
}

#[tauri::command]
pub fn rules_status(app: AppHandle, state: State<'_, RulesState>) -> Result<RulesStatus> {
    let idx = index(&app, &state)?;
    Ok(RulesStatus { dir: idx.dir.display().to_string(), entries: idx.entries.len(), effective: idx.effective.clone() })
}

#[tauri::command]
pub fn rules_search(app: AppHandle, state: State<'_, RulesState>, query: String, limit: Option<usize>) -> Result<Vec<RuleEntry>> {
    let idx = index(&app, &state)?;
    Ok(idx.search(&query, limit.unwrap_or(40).clamp(1, 200)))
}

#[tauri::command]
pub fn rules_get(app: AppHandle, state: State<'_, RulesState>, number: String) -> Result<Option<RuleEntry>> {
    let idx = index(&app, &state)?;
    Ok(idx.get(&number).cloned())
}

#[cfg(test)]
mod tests {
    use super::*;

    fn repo_rules_dir() -> PathBuf {
        Path::new(env!("CARGO_MANIFEST_DIR")).join("../../knowledge/mtg-rules")
    }

    #[test]
    fn splits_rule_numbers() {
        assert_eq!(split_rule_number("603.6c Leaves-the-battlefield abilities"), Some(("603.6c".into(), "Leaves-the-battlefield abilities")));
        assert_eq!(split_rule_number("601. Casting Spells"), Some(("601".into(), "Casting Spells")));
        assert_eq!(split_rule_number("6. Spells, Abilities, and Effects"), Some(("6".into(), "Spells, Abilities, and Effects")));
        assert_eq!(split_rule_number("704.5a If a player has 0 or less life"), Some(("704.5a".into(), "If a player has 0 or less life")));
        assert_eq!(split_rule_number("Glossary"), None);
        assert_eq!(split_rule_number("2026-06-19 something"), None);
    }

    #[test]
    fn rule_number_detection_and_sorting() {
        assert!(looks_like_rule_number("603.6c"));
        assert!(looks_like_rule_number("603"));
        assert!(looks_like_rule_number("603.10"));
        assert!(!looks_like_rule_number("sacrifice"));
        assert!(!looks_like_rule_number("603.6cd"));
        assert!(rule_sort_key("603.2") < rule_sort_key("603.10"));
        assert!(rule_sort_key("603.6a") < rule_sort_key("603.6b"));
    }

    #[test]
    fn loads_bundled_rules_and_answers_citations() {
        let idx = RulesIndex::load(&repo_rules_dir()).expect("rules dir");
        assert!(idx.entries.len() > 3000, "entries = {}", idx.entries.len());
        assert_eq!(idx.effective.as_deref(), Some("June 19, 2026"));
        let r = idx.get("704.5a").expect("704.5a");
        assert!(r.text.starts_with("If a player has 0 or less life"));
        assert_eq!(r.section, "7. Additional Rules");
        let hits = idx.search("603.6", 10);
        assert_eq!(hits[0].number, "603.6");
        assert!(hits.iter().any(|h| h.number == "603.6c"));
        let kw = idx.search("sacrifice cost", 5);
        assert!(!kw.is_empty());
        assert!(kw.iter().all(|h| h.text.to_lowercase().contains("sacrifice")));
        let g = idx.search("aristocrat", 5);
        assert!(g.is_empty(), "no such glossary term should exist");
        let glossary = idx.search("Activated Ability", 5);
        assert!(glossary.iter().any(|h| h.kind == RuleKind::Glossary && h.number == "Activated Ability"));
    }
}
