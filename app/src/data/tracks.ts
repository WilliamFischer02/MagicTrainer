import { parseOpponentTrack } from "../core/opponent/schema";
import type { OpponentTrack } from "../core/types";

/**
 * Bundled opponent tracks (`/opponent-tracks/*.track.json`, D-007 static timelines). Vite inlines
 * them at build time; in dev the repo root is allowed via `server.fs.allow`. Invalid files are
 * reported, never thrown, so one bad track cannot take the Trainer down.
 */

const modules = import.meta.glob("../../../opponent-tracks/*.track.json", { eager: true, import: "default" }) as Record<string, unknown>;

const loaded: OpponentTrack[] = [];
const errors: string[] = [];
for (const [path, json] of Object.entries(modules).sort(([a], [b]) => a.localeCompare(b))) {
  const r = parseOpponentTrack(json);
  const file = path.replace(/^.*[\\/]/, "");
  if (r.track) loaded.push(r.track);
  else errors.push(`${file}: ${r.errors.join("; ")}`);
}

export const TRACKS: readonly OpponentTrack[] = loaded;
export const TRACK_LOAD_ERRORS: readonly string[] = errors;

export function trackById(id: string | undefined | null): OpponentTrack | undefined {
  return id ? TRACKS.find((t) => t.id === id) : undefined;
}

/** Sensible default opponent for a format: Commander decks meet the precon-value table, 60-card decks meet aggro. */
export function defaultTrackFor(format: string | undefined): OpponentTrack | undefined {
  const preferred = format === "commander" ? ["edh-precon-value", "mono-red-aggro"] : ["mono-red-aggro", "uw-control"];
  for (const id of preferred) {
    const t = trackById(id);
    if (t) return t;
  }
  return TRACKS[0];
}
