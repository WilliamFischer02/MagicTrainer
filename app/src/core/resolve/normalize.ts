/**
 * Card-name normalization shared by the resolver (TS) and the bulk importer (Rust,
 * `app/src-tauri/rust/normalize.rs`). The two implementations MUST agree byte-for-byte;
 * `__tests__/resolve.test.ts` and `cargo test` share the golden fixtures in
 * `normalize.golden.json`.
 *
 * Pipeline (in order):
 *  1. NFKD, then drop combining marks (U+0300–U+036F): "Lim-Dûl" → "Lim-Dul"
 *  2. Ligatures/letters NFKD leaves alone: æ→ae, œ→oe, ß→ss, ø→o, đ→d, ł→l
 *  3. Typographic quotes/dashes → ASCII: ’‘ → ',  “” → ",  – — → -
 *  4. Lowercase
 *  5. Normalize " // " separators (any spacing around "//" becomes exactly " // ")
 *  6. Collapse whitespace, trim
 */
export function normalizeCardName(raw: string): string {
  let s = raw.normalize("NFKD").replace(/[̀-ͯ]/g, "");
  s = s
    .replace(/æ/g, "ae")
    .replace(/Æ/g, "AE")
    .replace(/œ/g, "oe")
    .replace(/Œ/g, "OE")
    .replace(/ß/g, "ss")
    .replace(/ø/g, "o")
    .replace(/Ø/g, "O")
    .replace(/đ/g, "d")
    .replace(/Đ/g, "D")
    .replace(/ł/g, "l")
    .replace(/Ł/g, "L");
  s = s.replace(/[‘’ʼ]/g, "'").replace(/[“”]/g, '"').replace(/[–—]/g, "-");
  s = s.toLowerCase();
  s = s.replace(/\s*\/\/\s*/g, " // ");
  return s.replace(/\s+/g, " ").trim();
}

/**
 * A punctuation-insensitive key for forgiving matches ("Athreos God of Passage",
 * "lim duls vault"). Built on top of `normalizeCardName`: apostrophes are dropped, every
 * other punctuation run becomes a single space. Faces are NOT split here.
 */
export function looseCardKey(raw: string): string {
  return normalizeCardName(raw)
    .replace(/'/g, "")
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/** "Fire // Ice" → ["Fire", "Ice"]; "Sol Ring" → ["Sol Ring"]. Operates on raw or normalized names. */
export function splitFaceNames(name: string): string[] {
  return name
    .split(/\s*\/\/\s*/)
    .map((s) => s.trim())
    .filter((s) => s.length > 0);
}
