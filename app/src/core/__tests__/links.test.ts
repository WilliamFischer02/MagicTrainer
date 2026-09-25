import { describe, expect, it } from "vitest";
import { cardKingdomSearchUrl, displayPrice, formatUsd, scryfallSearchUrl } from "../links";

describe("outbound links and prices", () => {
  it("builds a Card Kingdom name search with encoded punctuation", () => {
    expect(cardKingdomSearchUrl("Vito, Thorn of the Dusk Rose")).toBe(
      "https://www.cardkingdom.com/catalog/search?search=header&filter%5Bname%5D=Vito%2C%20Thorn%20of%20the%20Dusk%20Rose",
    );
    expect(scryfallSearchUrl("Fire // Ice")).toContain(encodeURIComponent('!"Fire // Ice"'));
  });

  it("prefers the cheapest printing and formats dollars", () => {
    expect(displayPrice({ usd: 12.08, usdMin: 1.5 })).toBe(1.5);
    expect(displayPrice({ usd: 12.08 })).toBe(12.08);
    expect(displayPrice(undefined)).toBeUndefined();
    expect(formatUsd(1.5)).toBe("$1.50");
    expect(formatUsd(249.99)).toBe("$250");
    expect(formatUsd(undefined)).toBe("—");
  });
});
