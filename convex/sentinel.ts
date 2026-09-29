/**
 * Sentinel wiring for this app's real data. Two checks today, both against things that already
 * exist in convex/schema.ts — deliberately not a check against a ledger, loyalty tier or NEXA
 * balance, because none of those tables exist here yet (see the design-system repo's
 * docs/12-status-and-decisions.md for what is still PLANNED). Adding a fake check against a
 * table that doesn't exist would violate this codebase's own "no fake implementation" rule
 * (see the comment at the top of convex/orders.ts).
 *
 * 1. stuck-pending-payment — an order sitting in "pending_payment" past a reasonable window is
 *    either an abandoned checkout or a payment integration silently failing. Either way, a human
 *    (or, once wired, an automated nudge/expiry job) should see it.
 * 2. idempotency-integrity — `orders.idempotencyKey` is meant to be unique (checkoutSubmit looks
 *    it up before inserting). This check actually verifies that promise against the real table
 *    instead of just trusting the index, the same way ledgerReconcileCheck verifies "value is
 *    conserved" instead of trusting bookkeeping.
 *
 * Both checks only ever report and, where safe, recommend — see sweep()'s heal semantics in
 * src/lib/evara-ecosystem/sentinel.ts. Neither one mutates an order. Run runHealthSweep from an
 * admin view today; wiring it to a scheduled cron is the natural next step once someone wants
 * this running unattended (see docs/11-sentinel-self-healing-and-evolution.md in the design repo).
 */
import { v } from "convex/values";
import { query } from "./_generated/server";
import { sweep, type HealthCheck, type HealthResult, type HealResult } from "../src/lib/evara-ecosystem/sentinel";

const STUCK_AFTER_MS = 2 * 60 * 60 * 1000; // 2 hours
const RECENT_ORDER_WINDOW = 500; // most recent orders considered per sweep, newest first

function stuckPendingPaymentCheck(orders: Array<{ _id: string; status: string; _creationTime: number }>, now: number): HealthCheck {
  return {
    id: "orders.stuck-pending-payment",
    defends: "checkout does not silently strand a customer between cart and payment",
    run: (): HealthResult => {
      const stuck = orders.filter((o) => o.status === "pending_payment" && now - o._creationTime > STUCK_AFTER_MS);
      if (stuck.length === 0) return { id: "orders.stuck-pending-payment", status: "OK", detail: "no order stuck in pending_payment past the window", at: now };
      const status = stuck.length >= 10 ? "CRITICAL" : "DEGRADED";
      return { id: "orders.stuck-pending-payment", status, detail: `${stuck.length} order(s) stuck in pending_payment for over ${STUCK_AFTER_MS / 3_600_000}h: ${stuck.slice(0, 10).map((o) => o._id).join(", ")}`, at: now };
    },
    heal: (result): HealResult => ({
      checkId: "orders.stuck-pending-payment",
      action: "flag-for-follow-up",
      target: "orders",
      outcome: "ESCALATED",
      detail: `${result.detail}. Recommend an expiry/nudge job once payment capture is wired up — Sentinel does not cancel or modify orders itself.`,
    }),
  };
}

function idempotencyIntegrityCheck(orders: Array<{ _id: string; idempotencyKey: string }>, now: number): HealthCheck {
  return {
    id: "orders.idempotency-integrity",
    defends: "nothing happens twice — one idempotencyKey never backs two orders",
    run: (): HealthResult => {
      const byKey = new Map<string, string[]>();
      for (const o of orders) byKey.set(o.idempotencyKey, [...(byKey.get(o.idempotencyKey) ?? []), o._id]);
      const dupes = [...byKey.entries()].filter(([, ids]) => ids.length > 1);
      if (dupes.length === 0) return { id: "orders.idempotency-integrity", status: "OK", detail: `${orders.length} order(s) checked, all idempotency keys unique`, at: now };
      return { id: "orders.idempotency-integrity", status: "CRITICAL", detail: `${dupes.length} idempotencyKey(s) back more than one order: ${dupes.map(([k, ids]) => `${k} -> [${ids.join(",")}]`).join("; ")}`, at: now };
    },
    heal: (result): HealResult => ({
      checkId: "orders.idempotency-integrity",
      action: "freeze-and-escalate",
      target: "orders",
      outcome: "ESCALATED",
      detail: `${result.detail}. This is the same invariant a ledger relies on; treat it like a money bug, not a UI bug. Sentinel never merges or deletes an order itself.`,
    }),
  };
}

export const runHealthSweep = query({
  args: {},
  returns: v.object({
    at: v.number(),
    status: v.union(v.literal("OK"), v.literal("DEGRADED"), v.literal("CRITICAL")),
    results: v.array(v.object({ id: v.string(), status: v.string(), detail: v.string(), at: v.number() })),
    heals: v.array(v.object({ checkId: v.string(), action: v.string(), target: v.string(), outcome: v.string(), detail: v.string() })),
  }),
  handler: async (ctx) => {
    const now = Date.now();
    const orders = await ctx.db.query("orders").order("desc").take(RECENT_ORDER_WINDOW);
    const slim = orders.map((o) => ({ _id: o._id, status: o.status, _creationTime: o._creationTime, idempotencyKey: o.idempotencyKey }));

    const checks: HealthCheck[] = [
      stuckPendingPaymentCheck(slim, now),
      idempotencyIntegrityCheck(slim, now),
    ];

    const report = sweep(checks, now);
    return {
      at: report.at,
      status: report.status,
      results: report.results,
      heals: report.heals,
    };
  },
});
