import { create } from "zustand";
import type { RuleEntry } from "../bridge/rules";

/** App-level UI state: mode, route, context panel. Server/DB state lives in TanStack Query (`queries.ts`). */

export type Mode = "builder" | "trainer";
export type Route = "decks" | "collection" | "rules" | "settings";
export type ContextItem = { kind: "rule"; entry: RuleEntry };

export interface AppState {
  mode: Mode;
  route: Route;
  context: ContextItem | null;
  setMode: (mode: Mode) => void;
  navigate: (route: Route) => void;
  setContext: (item: ContextItem | null) => void;
}

/** `?route=rules&mode=trainer` on the dev URL selects the initial screen (screenshots, tests). */
function initialFromUrl(): { route: Route; mode: Mode } {
  const q = new URLSearchParams(globalThis.location?.search ?? "");
  const routes: Route[] = ["decks", "collection", "rules", "settings"];
  const route = routes.find((r) => r === q.get("route")) ?? "decks";
  const mode: Mode = q.get("mode") === "trainer" ? "trainer" : "builder";
  return { route, mode };
}

export const useAppStore = create<AppState>((set) => ({
  ...initialFromUrl(),
  context: null,
  setMode: (mode) => set({ mode }),
  navigate: (route) => set({ route }),
  setContext: (context) => set({ context }),
}));

export const ROUTES: { id: Route; label: string; hint: string }[] = [
  { id: "decks", label: "Decks", hint: "Your imported decks" },
  { id: "collection", label: "Collection", hint: "Cards you own" },
  { id: "rules", label: "Rules", hint: "Comprehensive Rules viewer" },
  { id: "settings", label: "Settings", hint: "Data, theme, about" },
];
