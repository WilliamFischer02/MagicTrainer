import { QueryClient, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { dbStatus } from "../bridge/bulk";
import { tauriDb } from "../bridge/db";
import { imageCacheClear, imageCacheStatus, imagePrefetch } from "../bridge/images";
import { clearCollection, importCollectionRows, type ImportMode } from "../bridge/collection";
import { deleteDeck, saveDeck } from "../bridge/decks";
import { comboCacheClear, comboCacheStatus, deckToSpellbookRequest, findMyCombos } from "../bridge/spellbook";
import type { Deck } from "../core/types";
import {
  collectionSummary,
  getCardByOracleId,
  getCardsByOracleIds,
  getDeck,
  getRulings,
  listCollectionCards,
  listDecks,
  loadNameIndex,
  ownedQuantities,
  searchCardNames,
  unresolvedCollectionRows,
  type CollectionFilter,
  type ResolvedCollectionRow,
} from "../data";

/**
 * TanStack Query layer over `src/data` (SQL) and `src/bridge` (Tauri commands).
 * Keys are namespaced so a bulk import can invalidate everything card-shaped at once
 * (`invalidateCardData`). Card rows never change between imports → long `staleTime`.
 */

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      refetchOnWindowFocus: false,
      staleTime: 5 * 60 * 1000,
    },
  },
});

const FOREVER = Number.POSITIVE_INFINITY;

export const keys = {
  dbStatus: ["db-status"] as const,
  cards: ["cards"] as const,
  card: (oracleId: string) => ["cards", "one", oracleId] as const,
  cardSet: (oracleIds: readonly string[]) => ["cards", "set", [...oracleIds].sort().join("|")] as const,
  search: (text: string, limit: number) => ["cards", "search", text, limit] as const,
  rulings: (oracleId: string) => ["cards", "rulings", oracleId] as const,
  nameIndex: ["cards", "name-index"] as const,
  imageCache: ["image-cache"] as const,
  comboCache: ["combo-cache"] as const,
  combos: (key: string) => ["combos", key] as const,
  decks: ["decks"] as const,
  deck: (id: string) => ["decks", "one", id] as const,
  collection: ["collection"] as const,
  collectionSummary: ["collection", "summary"] as const,
  collectionCards: (f: CollectionFilter) => ["collection", "cards", f] as const,
  collectionUnresolved: ["collection", "unresolved"] as const,
  owned: (ids: readonly string[]) => ["collection", "owned", [...ids].sort().join("|")] as const,
};

// ---- collection ------------------------------------------------------------------------

export function useCollectionSummary() {
  return useQuery({ queryKey: keys.collectionSummary, queryFn: () => collectionSummary(tauriDb), staleTime: 60 * 1000 });
}

export function useCollectionCards(filter: CollectionFilter, enabled = true) {
  return useQuery({
    queryKey: keys.collectionCards(filter),
    queryFn: () => listCollectionCards(tauriDb, filter),
    enabled,
    staleTime: 60 * 1000,
    placeholderData: (prev) => prev,
  });
}

export function useCollectionUnresolved(enabled = true) {
  return useQuery({ queryKey: keys.collectionUnresolved, queryFn: () => unresolvedCollectionRows(tauriDb), enabled, staleTime: 60 * 1000 });
}

/** Owned quantity per oracle id; empty map while loading. */
export function useOwned(oracleIds: readonly string[]) {
  return useQuery({
    queryKey: keys.owned(oracleIds),
    queryFn: () => ownedQuantities(tauriDb, oracleIds),
    enabled: oracleIds.length > 0,
    staleTime: 60 * 1000,
  });
}

export function useImportCollection() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (args: { rows: readonly ResolvedCollectionRow[]; sourceFormat: string; mode: ImportMode }) => importCollectionRows(args.rows, args.sourceFormat, args.mode),
    onSuccess: () => client.invalidateQueries({ queryKey: keys.collection }),
  });
}

export function useClearCollection() {
  const client = useQueryClient();
  return useMutation({ mutationFn: clearCollection, onSuccess: () => client.invalidateQueries({ queryKey: keys.collection }) });
}

// ---- decks ---------------------------------------------------------------------------

export function useDecks() {
  return useQuery({ queryKey: keys.decks, queryFn: () => listDecks(tauriDb), staleTime: 60 * 1000 });
}

export function useDeck(id: string | undefined) {
  return useQuery({
    queryKey: keys.deck(id ?? ""),
    queryFn: () => getDeck(tauriDb, id ?? ""),
    enabled: !!id,
    staleTime: 60 * 1000,
  });
}

export function useSaveDeck() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (deck: Deck) => saveDeck(deck),
    onSuccess: (_saved, deck) => Promise.all([client.invalidateQueries({ queryKey: keys.decks }), client.invalidateQueries({ queryKey: keys.deck(deck.id) })]),
  });
}

export function useDeleteDeck() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => deleteDeck(id),
    onSuccess: () => client.invalidateQueries({ queryKey: keys.decks }),
  });
}

export function useDbStatus() {
  return useQuery({ queryKey: keys.dbStatus, queryFn: dbStatus, staleTime: 30 * 1000 });
}

/** Call after any import so every card-derived query refetches. */
export async function invalidateCardData(client: QueryClient = queryClient): Promise<void> {
  await Promise.all([client.invalidateQueries({ queryKey: keys.dbStatus }), client.invalidateQueries({ queryKey: keys.cards })]);
}

export function useCard(oracleId: string | undefined) {
  return useQuery({
    queryKey: keys.card(oracleId ?? ""),
    queryFn: () => getCardByOracleId(tauriDb, oracleId ?? ""),
    enabled: !!oracleId,
    staleTime: FOREVER,
  });
}

export function useCards(oracleIds: readonly string[]) {
  return useQuery({
    queryKey: keys.cardSet(oracleIds),
    queryFn: () => getCardsByOracleIds(tauriDb, oracleIds),
    enabled: oracleIds.length > 0,
    staleTime: FOREVER,
  });
}

/** Autocomplete; `text` shorter than 2 characters is not queried. */
export function useCardSearch(text: string, limit = 12) {
  const q = text.trim();
  return useQuery({
    queryKey: keys.search(q, limit),
    queryFn: () => searchCardNames(tauriDb, q, limit),
    enabled: q.length >= 2,
    staleTime: FOREVER,
    placeholderData: (prev) => prev,
  });
}

export function useRulings(oracleId: string | undefined) {
  return useQuery({
    queryKey: keys.rulings(oracleId ?? ""),
    queryFn: () => getRulings(tauriDb, oracleId ?? ""),
    enabled: !!oracleId,
    staleTime: FOREVER,
  });
}

/** The in-memory resolver index (D-010). Built once per import; ~3.8 MB. */
export function useNameIndex(enabled = true) {
  return useQuery({ queryKey: keys.nameIndex, queryFn: () => loadNameIndex(tauriDb), enabled, staleTime: FOREVER, gcTime: FOREVER });
}

export function useImageCacheStatus() {
  return useQuery({ queryKey: keys.imageCache, queryFn: imageCacheStatus, staleTime: 10 * 1000 });
}

export function useClearImageCache() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: imageCacheClear,
    onSettled: () => client.invalidateQueries({ queryKey: keys.imageCache }),
  });
}

export function usePrefetchImages() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (urls: readonly string[]) => imagePrefetch(urls),
    onSettled: () => client.invalidateQueries({ queryKey: keys.imageCache }),
  });
}

export function useComboCacheStatus() {
  return useQuery({ queryKey: keys.comboCache, queryFn: comboCacheStatus, staleTime: 10 * 1000 });
}

export function useClearComboCache() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: comboCacheClear,
    onSettled: () => Promise.all([client.invalidateQueries({ queryKey: keys.comboCache }), client.invalidateQueries({ queryKey: ["combos"] })]),
  });
}

/** Stable request key for a deck's combo lookup (names + quantities, order-independent). */
export function comboRequestKey(deck: Pick<Deck, "main" | "commanders">): string {
  const req = deckToSpellbookRequest(deck);
  const line = (prefix: string, cards: { card: string; quantity: number }[]) => cards.map((c) => `${prefix}\t${c.card}\t${c.quantity}`).sort();
  return [...line("c", req.commanders), ...line("m", req.main)].join("\n");
}

/**
 * Confirmed + near-miss combos for a deck from Commander Spellbook. The Rust side caches
 * on disk for 24 h; this hook only avoids re-invoking within a session.
 */
export function useDeckCombos(deck: Pick<Deck, "main" | "commanders"> | undefined, enabled = true) {
  const req = deck ? deckToSpellbookRequest(deck) : undefined;
  const key = deck ? comboRequestKey(deck) : "";
  return useQuery({
    queryKey: keys.combos(key),
    queryFn: () => findMyCombos(req ?? { main: [] }),
    enabled: enabled && !!req && (req.main.length > 0 || req.commanders.length > 0),
    staleTime: 60 * 60 * 1000,
  });
}
