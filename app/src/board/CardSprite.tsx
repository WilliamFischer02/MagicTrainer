import { cardImageSrc } from "../bridge/images";
import type { ZoneCard } from "../core/trainer/boardState";
import type { CardOracle } from "../core/types";
import b from "./board.module.css";

/**
 * One card on the board: an art-crop tile (Q-006) with the name underneath. `data-key` lets the
 * scene measure positions for FLIP moves and arrows. Never upscaled: the tile is smaller than
 * Scryfall's 626×457 art crop at every DPR the app targets.
 */

export type SpriteSize = "xs" | "sm" | "md";

export function CardSprite({
  card,
  oracle,
  size = "sm",
  highlight = false,
  pulseLabel,
  faceDown = false,
}: {
  card: ZoneCard;
  oracle?: CardOracle;
  size?: SpriteSize;
  highlight?: boolean;
  pulseLabel?: string;
  faceDown?: boolean;
}) {
  const art = faceDown ? undefined : cardImageSrc(oracle?.imageUris?.art_crop);
  const cls = [b.sprite, b[`sprite_${size}`], card.attacking ? b.attacking : "", highlight ? b.highlight : "", card.placeholder ? b.placeholder : "", faceDown ? b.faceDown : ""]
    .filter(Boolean)
    .join(" ");
  const title = oracle ? `${oracle.name} — ${oracle.typeLine}${oracle.oracleText ? `\n${oracle.oracleText}` : ""}` : card.name;
  return (
    <div className={cls} data-key={card.key} title={title} role="img" aria-label={faceDown ? "face-down card" : card.name}>
      <div className={b.art}>
        {art ? <img src={art} alt="" decoding="async" /> : <span className={b.artFallback} aria-hidden="true">{faceDown ? "" : initials(card.name)}</span>}
        {oracle?.manaCost && !faceDown && <span className={b.mv}>{oracle.cmc}</span>}
      </div>
      {!faceDown && <span className={b.name}>{card.name.replace(/^\[|\]$/g, "")}</span>}
      {pulseLabel && (
        <span className={b.pulse} role="status">
          <span className={b.pulseRing} aria-hidden="true" />
          <span className={b.pulseLabel}>{pulseLabel}</span>
        </span>
      )}
    </div>
  );
}

function initials(name: string): string {
  return name
    .replace(/^\[|\]$/g, "")
    .split(/[\s,]+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0]!.toUpperCase())
    .join("");
}
