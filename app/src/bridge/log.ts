import { invoke } from "@tauri-apps/api/core";
import { z } from "zod";

/** Local diagnostics log (`rust/applog.rs`, Q-011: never uploaded). Fails silently — logging must not break the app. */

export type LogLevel = "info" | "warn" | "error";

export function logEvent(level: LogLevel, source: string, message: string): void {
  if (typeof window === "undefined" || !("__TAURI_INTERNALS__" in window)) return;
  invoke("log_event", { level, source, message: message.slice(0, 4000) }).catch(() => undefined);
}

export const LogStatusSchema = z.object({ path: z.string(), bytes: z.number(), tail: z.array(z.string()) });
export type LogStatus = z.infer<typeof LogStatusSchema>;

export async function logStatus(lines = 50): Promise<LogStatus> {
  return LogStatusSchema.parse(await invoke("log_status", { lines }));
}

/** Wire `window.onerror` / unhandled promise rejections into the log once per page. */
export function installErrorLogging(): void {
  if (typeof window === "undefined") return;
  const w = window as Window & { __mtErrorLogging?: boolean };
  if (w.__mtErrorLogging) return;
  w.__mtErrorLogging = true;
  window.addEventListener("error", (e) => {
    logEvent("error", "window.onerror", `${e.message} @ ${e.filename}:${e.lineno}:${e.colno}${e.error instanceof Error && e.error.stack ? `\n${e.error.stack}` : ""}`);
  });
  window.addEventListener("unhandledrejection", (e) => {
    const r: unknown = e.reason;
    logEvent("error", "unhandledrejection", r instanceof Error ? (r.stack ?? r.message) : String(r));
  });
  logEvent("info", "app", `started ${navigator.userAgent}`);
}
