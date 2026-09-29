/**
 * Money is an integer count of minor units (kobo for NGN). Never a float.
 * Points and Coins are NOT money and never pass through these helpers.
 */
export type Minor = bigint;

export interface Currency {
  code: string;
  decimals: number;
  symbol: string;
}

export const NGN: Currency = { code: "NGN", decimals: 2, symbol: "\u20A6" };

export class MoneyError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "MoneyError";
  }
}

/** Parses "1,250.50" exactly. Rejects negatives, extra decimals and junk. */
export function parseMajor(text: string, c: Currency = NGN): Minor {
  const m = /^(\d+)(?:\.(\d+))?$/.exec(text.trim().replace(/,/g, ""));
  if (!m || m[1] === undefined) throw new MoneyError(`Invalid amount: "${text}"`);
  const frac = m[2] ?? "";
  if (frac.length > c.decimals) throw new MoneyError(`Too many decimal places for ${c.code}: "${text}"`);
  return BigInt(m[1] + frac.padEnd(c.decimals, "0"));
}

export function formatMinor(v: Minor, c: Currency = NGN): string {
  const neg = v < 0n;
  const s = (neg ? -v : v).toString().padStart(c.decimals + 1, "0");
  const whole = s.slice(0, s.length - c.decimals).replace(/\B(?=(\d{3})+(?!\d))/g, ",");
  const frac = c.decimals > 0 ? "." + s.slice(s.length - c.decimals) : "";
  return `${neg ? "-" : ""}${c.symbol}${whole}${frac}`;
}

/** amount * bps / 10000, rounded half up. Amount and bps must be non-negative. */
export function bpsOf(amount: Minor, bps: number): Minor {
  if (amount < 0n) throw new MoneyError("bpsOf: amount must be non-negative");
  if (!Number.isInteger(bps) || bps < 0) throw new MoneyError("bpsOf: bps must be a non-negative integer");
  return (amount * BigInt(bps) + 5000n) / 10000n;
}

export const minOf = (a: Minor, b: Minor): Minor => (a < b ? a : b);
export const maxOf = (a: Minor, b: Minor): Minor => (a > b ? a : b);
