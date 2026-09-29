/**
 * Market pricing engine — pure functions only, no I/O. Turns a supplier
 * (CJ) cost into a customer-facing sell price. Deliberately separate from
 * money.ts's Minor/bigint type: costMinor/priceMinor on products are plain
 * numbers (see convex/schema.ts), matching how the rest of the catalog
 * already stores prices.
 *
 * Not yet wired to an actual CJ sync job — there is no CJ integration
 * running yet. This exists so that whenever CJ sync lands, updating a
 * product's cost has a single, auditable place that decides the new price,
 * instead of ad-hoc math scattered wherever the sync happens to run.
 */

export interface MarginRule {
  /** e.g. 0.4 for a 40% markup over cost. */
  marginPct: number
  /** Absolute floor added on top of cost regardless of margin — covers small-ticket items where a pure % margin would be too thin. */
  minMarginMinor?: number
}

export type RoundingRule =
  | { kind: "none" }
  | { kind: "psychological"; ending: number } // e.g. ending=99 -> ...,X99

/**
 * costMinor -> priceMinor. Never returns a price below cost, even if the
 * margin rule or rounding would otherwise push it there — a pricing bug
 * should never be able to sell at a loss.
 */
export function computeSellPrice(costMinor: number, rule: MarginRule, rounding: RoundingRule = { kind: "none" }): number {
  if (costMinor < 0) throw new Error("computeSellPrice: costMinor must be non-negative")
  if (rule.marginPct < 0) throw new Error("computeSellPrice: marginPct must be non-negative")

  const marginAmount = Math.max(
    Math.round(costMinor * rule.marginPct),
    rule.minMarginMinor ?? 0,
  )
  let price = costMinor + marginAmount

  if (rounding.kind === "psychological") {
    const base = Math.floor(price / 100) * 100
    const candidate = base + rounding.ending
    // Only round down to the psychological ending if that doesn't dip below cost.
    price = candidate >= costMinor ? candidate : candidate + 100
  }

  return Math.max(price, costMinor)
}

/** compareAtPriceMinor for a sale — same floor guarantee as computeSellPrice. */
export function computeCompareAtPrice(sellPriceMinor: number, discountPct: number): number {
  if (discountPct <= 0 || discountPct >= 1) throw new Error("computeCompareAtPrice: discountPct must be between 0 and 1 (exclusive)")
  return Math.round(sellPriceMinor / (1 - discountPct))
}
