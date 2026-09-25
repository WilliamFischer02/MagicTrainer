import { invoke } from "@tauri-apps/api/core";
import { z } from "zod";

/**
 * Card images through the Rust disk cache (`app/src-tauri/rust/images.rs`).
 *
 * Inside Tauri, `https://cards.scryfall.io/...` is rewritten to the `mtimg` custom protocol,
 * which serves from `<cache>/images` and downloads on a miss (≤ 10 req/s, project User-Agent).
 * Outside Tauri (Vitest, plain Vite in a browser) the Scryfall URL is used unchanged.
 */

const SCRYFALL_IMAGE_ORIGIN = "https://cards.scryfall.io/";
/** Windows form of a Tauri custom scheme (the app is Windows-only; see D-001). */
const MTIMG_ORIGIN = "http://mtimg.localhost/";

export function isTauri(): boolean {
  return typeof window !== "undefined" && "__TAURI_INTERNALS__" in window;
}

/** `src` for an `<img>`: cached-protocol URL inside Tauri, remote URL elsewhere, undefined when absent. */
export function cardImageSrc(url: string | undefined | null): string | undefined {
  if (!url) return undefined;
  if (isTauri() && url.startsWith(SCRYFALL_IMAGE_ORIGIN)) return MTIMG_ORIGIN + url.slice(SCRYFALL_IMAGE_ORIGIN.length);
  return url;
}

export const ImageCacheStatusSchema = z.object({
  dir: z.string(),
  files: z.number(),
  bytes: z.number(),
  hits: z.number(),
  misses: z.number(),
  errors: z.number(),
});
export type ImageCacheStatus = z.infer<typeof ImageCacheStatusSchema>;

export const PrefetchReportSchema = z.object({
  requested: z.number(),
  fetched: z.number(),
  alreadyCached: z.number(),
  failed: z.array(z.string()),
  seconds: z.number(),
});
export type PrefetchReport = z.infer<typeof PrefetchReportSchema>;

export async function imageCacheStatus(): Promise<ImageCacheStatus> {
  return ImageCacheStatusSchema.parse(await invoke("image_cache_status"));
}

/** Delete every cached image; resolves to bytes freed. */
export async function imageCacheClear(): Promise<number> {
  return z.number().parse(await invoke("image_cache_clear"));
}

/** Warm the cache for a list of Scryfall image URLs (e.g. all cards of a deck after import). */
export async function imagePrefetch(urls: readonly string[]): Promise<PrefetchReport> {
  const scryfall = urls.filter((u) => u.startsWith(SCRYFALL_IMAGE_ORIGIN));
  if (scryfall.length === 0) return { requested: 0, fetched: 0, alreadyCached: 0, failed: [], seconds: 0 };
  return PrefetchReportSchema.parse(await invoke("image_prefetch", { urls: scryfall }));
}
