/**
 * Outbound links. Scryfall stopped shipping a Card Kingdom purchase URI (verified 2026-09-24:
 * `purchase_uris` has cardhoarder / cardmarket / tcgplayer only), so the Card Kingdom link is a
 * name search on their site (Q-004). Framework-free.
 */

export function cardKingdomSearchUrl(cardName: string): string {
  return `https://www.cardkingdom.com/catalog/search?search=header&filter%5Bname%5D=${encodeURIComponent(cardName)}`;
}

export function scryfallSearchUrl(cardName: string): string {
  return `https://scryfall.com/search?q=${encodeURIComponent(`!"${cardName}"`)}`;
}

/** Budget-first display price: cheapest printing when known, else the representative printing. */
export function displayPrice(prices: { usd?: number; usdMin?: number } | undefined): number | undefined {
  if (!prices) return undefined;
  return prices.usdMin ?? prices.usd;
}

export function formatUsd(n: number | undefined): string {
  if (n === undefined) return "—";
  return n >= 100 ? `$${Math.round(n)}` : `$${n.toFixed(2)}`;
}
