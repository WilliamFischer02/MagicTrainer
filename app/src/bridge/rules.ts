import { invoke } from "@tauri-apps/api/core";
import { z } from "zod";

/** Comprehensive Rules viewer commands (`app/src-tauri/rust/rules.rs`). */

export const RuleEntrySchema = z.object({
  number: z.string(),
  text: z.string(),
  section: z.string(),
  kind: z.enum(["heading", "rule", "glossary"]),
});
export type RuleEntry = z.infer<typeof RuleEntrySchema>;

export const RulesStatusSchema = z.object({
  dir: z.string(),
  entries: z.number(),
  effective: z.string().nullable(),
});
export type RulesStatus = z.infer<typeof RulesStatusSchema>;

export async function rulesStatus(): Promise<RulesStatus> {
  return RulesStatusSchema.parse(await invoke("rules_status"));
}

export async function rulesSearch(query: string, limit = 40): Promise<RuleEntry[]> {
  return z.array(RuleEntrySchema).parse(await invoke("rules_search", { query, limit }));
}

export async function rulesGet(number: string): Promise<RuleEntry | null> {
  return RuleEntrySchema.nullable().parse(await invoke("rules_get", { number }));
}

/** "CR 603.6c" — the citation form used in step notes and docs. */
export function citation(entry: Pick<RuleEntry, "number" | "kind">): string {
  return entry.kind === "glossary" ? `CR Glossary: ${entry.number}` : `CR ${entry.number}`;
}
