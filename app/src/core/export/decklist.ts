import type { Deck, DeckEntry } from "../types";

/**
 * Decklist text export in the dialects the importer reads back (`docs/IMPORT_FORMATS.md` §Export):
 *  - moxfield: `Commander` / `Deck` / `Sideboard` / `<Extra>` sections, `1 Card Name`
 *  - arena:    `1 Card Name (SET) 123` when the printing is known, sections `Commander` / `Deck` / `Sideboard`
 *  - mtgo:     `1 Card Name`, sideboard lines prefixed `SB: `, commanders listed first with a `// Commander` comment
 * Framework-free; round-trips through `parseDecklist`.
 */

export type ExportDialect = "moxfield" | "arena" | "mtgo";

export const EXPORT_DIALECTS: { id: ExportDialect; label: string; hint: string }[] = [
  { id: "moxfield", label: "Moxfield / Archidekt", hint: "Section headers, one card per line" },
  { id: "arena", label: "MTG Arena", hint: "Adds (SET) collector number when known" },
  { id: "mtgo", label: "MTGO", hint: "SB: prefix for the sideboard" },
];

function line(e: DeckEntry, dialect: ExportDialect): string {
  const base = `${e.quantity} ${e.name}`;
  if (dialect === "arena" && e.setCode) {
    const cn = e.collectorNumber ? ` ${e.collectorNumber}` : "";
    return `${base} (${e.setCode.toUpperCase()})${cn}`;
  }
  return base;
}

function section(title: string, entries: DeckEntry[], dialect: ExportDialect): string[] {
  if (entries.length === 0) return [];
  return [title, ...entries.map((e) => line(e, dialect)), ""];
}

export function exportDecklist(deck: Pick<Deck, "name" | "format" | "commanders" | "main" | "sideboard" | "extra">, dialect: ExportDialect = "moxfield"): string {
  const out: string[] = [];
  if (dialect === "mtgo") {
    // `// Commander` / `// Deck` are comments to MTGO and section markers to our importer.
    if (deck.commanders.length) out.push("// Commander", ...deck.commanders.map((e) => line(e, dialect)), "", "// Deck");
    out.push(...deck.main.map((e) => line(e, dialect)));
    if (deck.sideboard.length) out.push("", ...deck.sideboard.map((e) => `SB: ${line(e, dialect)}`));
    return out.join("\n").trimEnd() + "\n";
  }
  out.push(...section("Commander", deck.commanders, dialect));
  out.push(...section("Deck", deck.main, dialect));
  out.push(...section("Sideboard", deck.sideboard, dialect));
  if (dialect === "moxfield") {
    for (const [name, entries] of Object.entries(deck.extra)) {
      out.push(...section(name.charAt(0).toUpperCase() + name.slice(1), entries, dialect));
    }
  }
  return out.join("\n").trimEnd() + "\n";
}

/** Safe file name for an export: "Athreos, God of Passage" → "Athreos-God-of-Passage.txt". */
export function exportFileName(deckName: string, dialect: ExportDialect): string {
  const stem = deckName
    .normalize("NFKD")
    .replace(/[^\w\s-]/g, "")
    .trim()
    .replace(/\s+/g, "-")
    .slice(0, 60);
  return `${stem || "deck"}${dialect === "moxfield" ? "" : `-${dialect}`}.txt`;
}
