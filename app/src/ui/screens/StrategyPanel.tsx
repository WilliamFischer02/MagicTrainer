import { useMemo, useState } from "react";
import { PATTERNS } from "../../core/strategy/patterns";
import { detectStrategies, type ResolvedCard } from "../../core/strategy/detector";
import { includedCombos, nearMissCombos, SPELLBOOK_SITE, type NearMissCombo } from "../../core/strategy/spellbook";
import { cardKingdomSearchUrl, displayPrice, formatUsd } from "../../core/links";
import type { CardOracle, Deck, StrategyMatch } from "../../core/types";
import { Button, Callout, Card, ExternalLink, Spinner } from "../components";
import { AlertIcon } from "../icons";
import { useCards, useDeckCombos, useNameIndex, useOwned } from "../queries";
import d from "./decks.module.css";
import s from "./screens.module.css";

/**
 * Strategy panel: local archetype/engine detection (with the role rationale, D-008) and
 * Commander Spellbook combos — confirmed ones and near-misses with the missing cards, their
 * TCGplayer-market price from Scryfall, and a Card Kingdom link (Q-004). Spellbook is credited
 * inline as their API guideline asks.
 */

export function StrategyPanel({ deck, cards }: { deck: Deck; cards: ReadonlyMap<string, CardOracle> }) {
  const resolved = useMemo<ResolvedCard[]>(() => {
    const out: ResolvedCard[] = [];
    for (const entry of [...deck.commanders, ...deck.main]) {
      const card = entry.oracleId ? cards.get(entry.oracleId) : undefined;
      if (card) out.push({ entry, card });
    }
    return out;
  }, [deck, cards]);
  const matches = useMemo(() => detectStrategies(resolved), [resolved]);
  const combos = useDeckCombos(deck);
  const deckNames = useMemo(() => [...deck.commanders, ...deck.main].map((e) => e.name), [deck]);
  const confirmed = combos.data ? includedCombos(combos.data.results) : [];
  const near = combos.data ? nearMissCombos(combos.data.results, deckNames, 8) : [];

  return (
    <div className={d.analysisGrid}>
      <Card title="Detected strategies">
        {matches.length === 0 ? (
          <p className={d.muted}>
            No archetype or engine pattern fired. That usually means a pile without a plan, or an archetype MagicTrainer does not know yet — the {PATTERNS.length} patterns
            it checks are listed in the docs.
          </p>
        ) : (
          <ul className={d.matchList}>
            {matches.map((m) => (
              <MatchRow key={m.patternId} match={m} />
            ))}
          </ul>
        )}
      </Card>

      <Card title="Combos">
        {combos.isPending && (
          <div className={s.state} role="status" style={{ marginTop: 0 }}>
            <Spinner /> Asking Commander Spellbook…
          </div>
        )}
        {combos.error && (
          <Callout tone="warn" icon={<AlertIcon />}>
            Commander Spellbook is unreachable right now: {combos.error instanceof Error ? combos.error.message : String(combos.error)}. Combos will load when you are back online.
          </Callout>
        )}
        {combos.data && (
          <>
            {combos.data.stale && (
              <Callout tone="warn" icon={<AlertIcon />}>
                Showing a cached answer from {new Date(combos.data.fetchedAt).toLocaleString()} — refresh failed: {combos.data.warning}
              </Callout>
            )}
            {confirmed.length === 0 ? (
              <p className={d.muted}>No complete combo from Commander Spellbook's database is in this list.</p>
            ) : (
              <ul className={d.matchList}>
                {confirmed.map((m) => (
                  <MatchRow key={m.patternId} match={m} />
                ))}
              </ul>
            )}
            {near.length > 0 && (
              <>
                <h3 className={d.sectionTitle} style={{ marginTop: "var(--s-4)" }}>
                  <span>Near misses — one or two cards away</span>
                  <span>{near.length}</span>
                </h3>
                <NearMissList items={near} />
              </>
            )}
            <p className={d.muted} style={{ marginTop: "var(--s-3)" }}>
              Combo data by <ExternalLink href={SPELLBOOK_SITE}>Commander Spellbook</ExternalLink>
              {combos.data.cached ? " (cached)" : ""}. Prices are TCGplayer market via Scryfall; links go to Card Kingdom.
            </p>
          </>
        )}
      </Card>
    </div>
  );
}

function MatchRow({ match }: { match: StrategyMatch }) {
  const [open, setOpen] = useState(false);
  const pct = Math.round(match.confidence * 100);
  return (
    <li className={d.match}>
      <div className={d.matchHead}>
        <span className={d.matchLabel}>{match.label}</span>
        <span className={d.matchConf} title="Detector confidence">
          <span className={d.miniBar} aria-hidden="true">
            <span className={d.miniFill} style={{ width: `${pct}%` }} />
          </span>
          <span className={d.miniVal}>{pct}%</span>
        </span>
        <Button size="sm" variant="ghost" onClick={() => setOpen((v) => !v)} aria-expanded={open}>
          {open ? "Hide why" : "Why?"}
        </Button>
      </div>
      {open && (
        <div className={d.matchWhy}>
          <p className={d.rationale}>{match.rationale}</p>
          <dl className={d.roles}>
            {Object.entries(match.roles).map(([role, names]) => (
              <div key={role} className={d.roleItem}>
                <dt>{role.replace(/-/g, " ")}</dt>
                <dd>{names.join(", ")}</dd>
              </div>
            ))}
          </dl>
          {match.externalRef?.url && (
            <p className={d.muted}>
              <ExternalLink href={match.externalRef.url}>Open on Commander Spellbook</ExternalLink>
            </p>
          )}
        </div>
      )}
    </li>
  );
}

function NearMissList({ items }: { items: NearMissCombo[] }) {
  const index = useNameIndex();
  const missingNames = useMemo(() => [...new Set(items.flatMap((n) => n.missing))], [items]);
  const missingIds = useMemo(() => (index.data ? missingNames.map((n) => index.data!.resolve(n).oracleId).filter((x): x is string => !!x) : []), [index.data, missingNames]);
  const priced = useCards(missingIds);
  const owned = useOwned(missingIds);
  const byName = useMemo(() => {
    const m = new Map<string, CardOracle>();
    for (const c of priced.data?.values() ?? []) m.set(c.name.toLowerCase(), c);
    return m;
  }, [priced.data]);
  // "Owned first": near misses whose missing cards you already have float to the top.
  const ordered = useMemo(() => {
    if (!owned.data || owned.data.size === 0) return items;
    const ownedCount = (n: NearMissCombo) => n.missing.filter((name) => (owned.data!.get(byName.get(name.toLowerCase())?.oracleId ?? "") ?? 0) > 0).length;
    return [...items].sort((a, b) => ownedCount(b) - ownedCount(a));
  }, [items, owned.data, byName]);
  return (
    <ul className={d.matchList}>
      {ordered.map((n) => (
        <li key={n.variant.id} className={d.match}>
          <div className={d.matchHead}>
            <span className={d.matchLabel}>{n.match.label}</span>
            <span className={d.muted}>{n.reason === "almost" ? "" : n.reason.replace(/-/g, " ")}</span>
          </div>
          <div className={d.missingRow}>
            <span className={d.muted}>Add</span>
            {n.missing.map((name) => {
              const card = byName.get(name.toLowerCase());
              const usd = displayPrice(card?.prices);
              const have = card ? (owned.data?.get(card.oracleId) ?? 0) : 0;
              return (
                <span key={name} className={`${d.missingCard} ${have > 0 ? d.missingOwned : ""}`}>
                  <strong>{name}</strong>
                  {have > 0 && <span className={`${d.chip} ${d.chipOk}`}>you own {have}</span>}
                  {usd !== undefined && (
                    <span className={d.price} title="Cheapest printing, TCGplayer market via Scryfall">
                      {formatUsd(usd)}
                    </span>
                  )}
                  <ExternalLink href={cardKingdomSearchUrl(name)}>Card Kingdom</ExternalLink>
                </span>
              );
            })}
            <ExternalLink href={n.match.externalRef?.url ?? SPELLBOOK_SITE}>combo</ExternalLink>
          </div>
        </li>
      ))}
    </ul>
  );
}
