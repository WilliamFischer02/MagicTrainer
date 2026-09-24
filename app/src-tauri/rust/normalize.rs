//! Card-name normalization. MUST stay byte-for-byte identical to
//! `app/src/core/resolve/normalize.ts`; both are checked against the shared golden file
//! `app/src/core/resolve/normalize.golden.json` (see tests below).
//!
//! Pipeline: NFKD → drop combining marks → ligature/letter folds (æ, œ, ß, ø, đ, ł) →
//! typographic quotes/dashes to ASCII → lowercase → " // " separator normalization →
//! whitespace collapse + trim.

use unicode_normalization::UnicodeNormalization;

pub fn normalize_card_name(raw: &str) -> String {
    let mut s = String::with_capacity(raw.len());
    for ch in raw.nfkd() {
        if ('\u{0300}'..='\u{036f}').contains(&ch) {
            continue;
        }
        match ch {
            'æ' => s.push_str("ae"),
            'Æ' => s.push_str("AE"),
            'œ' => s.push_str("oe"),
            'Œ' => s.push_str("OE"),
            'ß' => s.push_str("ss"),
            'ø' => s.push('o'),
            'Ø' => s.push('O'),
            'đ' => s.push('d'),
            'Đ' => s.push('D'),
            'ł' => s.push('l'),
            'Ł' => s.push('L'),
            '\u{2018}' | '\u{2019}' | '\u{02bc}' => s.push('\''),
            '\u{201c}' | '\u{201d}' => s.push('"'),
            '\u{2013}' | '\u{2014}' => s.push('-'),
            _ => s.push(ch),
        }
    }
    let lower = s.to_lowercase();
    let separated = normalize_face_separator(&lower);
    collapse_whitespace(&separated)
}

/// Punctuation-insensitive key: apostrophes dropped, every other non-alphanumeric run → one space.
pub fn loose_card_key(raw: &str) -> String {
    let norm = normalize_card_name(raw);
    let mut out = String::with_capacity(norm.len());
    let mut pending_space = false;
    for ch in norm.chars() {
        if ch == '\'' {
            continue;
        }
        if ch.is_alphanumeric() {
            if pending_space && !out.is_empty() {
                out.push(' ');
            }
            pending_space = false;
            out.push(ch);
        } else {
            pending_space = true;
        }
    }
    out
}

/// "Fire // Ice" → ["Fire", "Ice"]; "Sol Ring" → ["Sol Ring"].
pub fn split_face_names(name: &str) -> Vec<String> {
    name.split("//")
        .map(|s| s.trim())
        .filter(|s| !s.is_empty())
        .map(str::to_string)
        .collect()
}

/// Any spacing around "//" becomes exactly " // " (mirrors the JS regex `\s*\/\/\s*`).
fn normalize_face_separator(s: &str) -> String {
    if !s.contains("//") {
        return s.to_string();
    }
    let parts: Vec<&str> = s.split("//").collect();
    let mut out = String::with_capacity(s.len() + 4);
    for (i, part) in parts.iter().enumerate() {
        let piece = if i == 0 {
            part.trim_end()
        } else if i == parts.len() - 1 {
            part.trim_start()
        } else {
            part.trim()
        };
        if i > 0 {
            out.push_str(" // ");
        }
        out.push_str(piece);
    }
    out
}

fn collapse_whitespace(s: &str) -> String {
    let mut out = String::with_capacity(s.len());
    let mut in_ws = false;
    for ch in s.chars() {
        if ch.is_whitespace() {
            in_ws = true;
        } else {
            if in_ws && !out.is_empty() {
                out.push(' ');
            }
            in_ws = false;
            out.push(ch);
        }
    }
    out
}

#[cfg(test)]
mod tests {
    use super::*;

    #[derive(serde::Deserialize)]
    struct Golden {
        cases: Vec<Case>,
    }
    #[derive(serde::Deserialize)]
    struct Case {
        input: String,
        norm: String,
        loose: String,
    }

    const GOLDEN: &str = include_str!("../../src/core/resolve/normalize.golden.json");

    #[test]
    fn matches_typescript_golden_fixtures() {
        let g: Golden = serde_json::from_str(GOLDEN).expect("golden json");
        assert!(g.cases.len() >= 15);
        for c in g.cases {
            assert_eq!(normalize_card_name(&c.input), c.norm, "norm of {:?}", c.input);
            assert_eq!(loose_card_key(&c.input), c.loose, "loose of {:?}", c.input);
        }
    }

    #[test]
    fn splits_faces() {
        assert_eq!(split_face_names("Fire // Ice"), vec!["Fire", "Ice"]);
        assert_eq!(split_face_names("Sol Ring"), vec!["Sol Ring"]);
    }
}
