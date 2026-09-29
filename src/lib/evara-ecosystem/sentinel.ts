/**
 * Sentinel: the self-healing and safe-evolution engine.
 *
 * Sentinel does not sit above the other engines and does not touch their internals — it watches
 * the same events and outputs everything else already produces (ledger reconciliation, dead
 * letters, risk assessments) and turns "something is wrong" or "something could be better" into
 * three kinds of output, always as data, never as a side effect the caller didn't ask for:
 *
 *   1. HEALTH   — is an invariant holding right now, checked continuously, not on faith.
 *   2. HEALING  — a recoverable failure gets a concrete, bounded, reversible recovery action.
 *   3. EVOLUTION — a tunable, non-money parameter drifts toward its target inside guardrails,
 *                  one small step at a time, with a cooldown, and it can always be reverted.
 *
 * Safety model, deliberately conservative:
 *   - Sentinel never mutates money. A ledger invariant failure is only ever escalated
 *     (HOLD_FOR_HUMAN-style), never "auto-corrected".
 *   - Sentinel never calls a handler, a queue or a database. It is pure: given the same inputs
 *     (checks, dead letters, samples) it returns the same outputs. The host process is the one
 *     that acts on a HealResult or a TuningProposal — Sentinel only ever recommends and records.
 *   - Every check, heal and tuning step produces an EvaraEvent (system.health.checked,
 *     system.heal.performed, system.handler.quarantined/resumed, system.tuning.proposed/applied/
 *     reverted) so the whole loop is the same audit trail the rest of the ecosystem already uses.
 *   - Evolution defaults to SHADOW mode: proposals are computed and logged but never treated as
 *     applied until the host explicitly calls applyTuning. Nothing "always evolves" invisibly.
 */
import type { EvaraEvent, DeadLetter } from "./events";

/* ---------------------------------- health ---------------------------------- */

export type HealthStatus = "OK" | "DEGRADED" | "CRITICAL";

export interface HealthResult {
  id: string;
  status: HealthStatus;
  detail: string;
  at: number;
}

export interface HealResult {
  checkId: string;
  action: string;
  target: string;
  outcome: "RECOVERED" | "ESCALATED" | "QUARANTINED" | "NO_OP";
  detail: string;
}

export interface HealthCheck {
  id: string;
  /** Which invariant or contract this defends, for the audit trail and for humans reading a report. */
  defends: string;
  run: (now: number) => HealthResult;
  /** Optional: what to try when the check is not OK. Never called for a check that came back OK. */
  heal?: (result: HealthResult, now: number) => HealResult;
}

export interface SweepReport {
  at: number;
  status: HealthStatus;
  results: HealthResult[];
  heals: HealResult[];
  events: EvaraEvent[];
}

const worstOf = (a: HealthStatus, b: HealthStatus): HealthStatus => {
  const rank: Record<HealthStatus, number> = { OK: 0, DEGRADED: 1, CRITICAL: 2 };
  return rank[b] > rank[a] ? b : a;
};

let seq = 0;
const nextId = (prefix: string): string => `${prefix}_${(seq++).toString(36)}`;

function makeEvent<P extends Record<string, unknown>>(
  type: EvaraEvent["type"],
  now: number,
  correlationId: string,
  payload: P,
): EvaraEvent<P> {
  return {
    id: nextId("evt"),
    type,
    occurredAt: now,
    actor: "sentinel",
    source: "sentinel",
    correlationId,
    causationId: null,
    idempotencyKey: nextId("idem"),
    schemaVersion: 1,
    payload,
  };
}

/**
 * Runs every registered check, then runs `heal` (if provided) for anything that is not OK.
 * Pure: takes `now`, returns a report. Never throws — a check that throws is treated as CRITICAL
 * so one broken check cannot hide the rest of the sweep or crash the host.
 */
export function sweep(checks: readonly HealthCheck[], now: number, correlationId = nextId("sweep")): SweepReport {
  const results: HealthResult[] = [];
  const heals: HealResult[] = [];
  const events: EvaraEvent[] = [];
  let overall: HealthStatus = "OK";

  for (const check of checks) {
    let result: HealthResult;
    try {
      result = check.run(now);
    } catch (err) {
      result = { id: check.id, status: "CRITICAL", detail: `check threw: ${err instanceof Error ? err.message : String(err)}`, at: now };
    }
    results.push(result);
    overall = worstOf(overall, result.status);
    events.push(makeEvent("system.health.checked", now, correlationId, { checkId: check.id, defends: check.defends, status: result.status, detail: result.detail }));

    if (result.status !== "OK" && check.heal) {
      let heal: HealResult;
      try {
        heal = check.heal(result, now);
      } catch (err) {
        heal = { checkId: check.id, action: "heal", target: check.id, outcome: "ESCALATED", detail: `heal threw: ${err instanceof Error ? err.message : String(err)}` };
      }
      heals.push(heal);
      events.push(makeEvent("system.heal.performed", now, correlationId, { ...heal }));
    }
  }

  return { at: now, status: overall, results, heals, events };
}

/* ------------------------------ ready-made checks ------------------------------ */

export interface ReconcileLike {
  ok: boolean;
  unitTotals: Record<string, bigint>;
  negativeCustomerAccounts: string[];
  drift: string[];
}

/**
 * Guards "value is conserved". Never self-heals: a ledger that does not balance is a CRITICAL
 * finding for a human, on purpose. Auto-correcting money is worse than leaving it broken and loud.
 */
export function ledgerReconcileCheck(reconcile: () => ReconcileLike): HealthCheck {
  return {
    id: "ledger.reconcile",
    defends: "value is conserved — every unit sums to zero across all accounts",
    run: (now) => {
      const r = reconcile();
      if (r.ok) return { id: "ledger.reconcile", status: "OK", detail: "all units balance, no drift, no negative customer accounts", at: now };
      const parts: string[] = [];
      if (r.negativeCustomerAccounts.length) parts.push(`${r.negativeCustomerAccounts.length} negative customer account(s)`);
      if (r.drift.length) parts.push(`${r.drift.length} cached balance(s) drifted from replay`);
      const unbalanced = Object.entries(r.unitTotals).filter(([, v]) => v !== 0n).map(([u]) => u);
      if (unbalanced.length) parts.push(`unit total(s) not zero: ${unbalanced.join(", ")}`);
      return { id: "ledger.reconcile", status: "CRITICAL", detail: parts.join("; ") || "reconcile reported not ok", at: now };
    },
    heal: (result) => ({
      checkId: "ledger.reconcile",
      action: "freeze-and-escalate",
      target: "ledger",
      outcome: "ESCALATED",
      detail: `money invariant broken: ${result.detail}. Sentinel never auto-corrects a ledger; this must go to human review.`,
    }),
  };
}

export interface QuarantineDecision {
  /** Handler names that have crossed the threshold and should stop receiving new events. */
  quarantine: string[];
  /** Handler names that are struggling but not yet over the threshold. */
  watch: string[];
}

/**
 * Pure triage over an EventBus's dead-letter list. A handler that dead-letters `threshold` or
 * more times inside `windowMs` is a broken handler, not a slow network — Sentinel recommends
 * quarantining it (host stops routing new events to it) rather than retrying forever into a
 * queue that never drains. Handlers below the threshold are surfaced as `watch` so a health
 * check can report DEGRADED before it becomes CRITICAL.
 */
export function triageDeadLetters(deadLetters: readonly DeadLetter[], now: number, threshold = 5, windowMs = 15 * 60_000): QuarantineDecision {
  const recent = deadLetters.filter((d) => now - d.at <= windowMs);
  const byHandler = new Map<string, number>();
  for (const d of recent) byHandler.set(d.handler, (byHandler.get(d.handler) ?? 0) + 1);
  const quarantine: string[] = [];
  const watch: string[] = [];
  for (const [handler, count] of byHandler) (count >= threshold ? quarantine : watch).push(handler);
  return { quarantine: quarantine.sort(), watch: watch.sort() };
}

/**
 * Guards "nothing happens twice / nothing gets silently lost". DEGRADED once any handler is
 * dead-lettering, CRITICAL once one crosses the quarantine threshold. Heal recommends quarantine
 * (a real EventBus would need `unsubscribe`/`subscribe` wired to act on this).
 */
export function deadLetterCheck(deadLetters: () => readonly DeadLetter[], threshold = 5, windowMs = 15 * 60_000): HealthCheck {
  return {
    id: "events.dead-letters",
    defends: "nothing happens twice, and nothing silently stops happening",
    run: (now) => {
      const decision = triageDeadLetters(deadLetters(), now, threshold, windowMs);
      if (!decision.quarantine.length && !decision.watch.length) return { id: "events.dead-letters", status: "OK", detail: "no dead letters in window", at: now };
      const status: HealthStatus = decision.quarantine.length ? "CRITICAL" : "DEGRADED";
      return { id: "events.dead-letters", status, detail: `quarantine: [${decision.quarantine.join(", ")}], watch: [${decision.watch.join(", ")}]`, at: now };
    },
    heal: (result, now) => {
      const decision = triageDeadLetters(deadLetters(), now, threshold, windowMs);
      if (!decision.quarantine.length) {
        return { checkId: "events.dead-letters", action: "watch", target: decision.watch.join(",") || "-", outcome: "NO_OP", detail: "below quarantine threshold; watching" };
      }
      return {
        checkId: "events.dead-letters",
        action: "quarantine-handler",
        target: decision.quarantine.join(","),
        outcome: "QUARANTINED",
        detail: `${decision.quarantine.length} handler(s) crossed ${threshold} failures in ${Math.round(windowMs / 60_000)}m: ${decision.quarantine.join(", ")}`,
      };
    },
  };
}

/* --------------------------------- evolution --------------------------------- */

export interface Tunable {
  id: string;
  /** What this knob controls, in plain language, for the audit trail. Never money or ledger math. */
  controls: string;
  min: number;
  max: number;
  current: number;
  /** Largest fraction of (max - min) Sentinel may move in one proposal. */
  maxStepFraction: number;
  /** No new proposal within this many ms of the last applied change, win or lose. */
  cooldownMs: number;
  lastChangedAt: number | null;
  /** Signal must clear this fraction of (max - min) before a step is worth proposing at all. */
  deadZoneFraction: number;
}

export interface TuningProposal {
  id: string;
  from: number;
  to: number;
  reason: string;
  mode: "SHADOW" | "LIVE";
}

const clamp = (v: number, min: number, max: number): number => Math.min(max, Math.max(min, v));

/**
 * One bounded, reversible evolution step. `signal` is "how far off target, and in which
 * direction", already computed by the caller from real outcomes — Sentinel does not invent the
 * signal, it only turns it into a safe step: clamped to the tunable's range, capped at
 * `maxStepFraction`, ignored inside the dead zone, and blocked entirely during cooldown so a
 * knob can't flap.
 *
 * mode defaults to SHADOW: the proposal is returned and can be logged (system.tuning.proposed),
 * but `tunable.current` is not considered changed until the host calls applyTuning.
 */
export function proposeTuning(tunable: Tunable, signal: number, now: number, mode: "SHADOW" | "LIVE" = "SHADOW"): TuningProposal | null {
  const range = tunable.max - tunable.min;
  if (range <= 0) return null;
  if (tunable.lastChangedAt !== null && now - tunable.lastChangedAt < tunable.cooldownMs) return null;
  if (Math.abs(signal) < tunable.deadZoneFraction) return null;

  const maxStep = range * tunable.maxStepFraction;
  const rawStep = clamp(signal, -1, 1) * maxStep;
  const to = clamp(tunable.current + rawStep, tunable.min, tunable.max);
  if (to === tunable.current) return null;

  return {
    id: nextId("tune"),
    from: tunable.current,
    to,
    reason: `signal ${signal.toFixed(3)} outside dead zone ${tunable.deadZoneFraction}; stepped by ${(to - tunable.current).toFixed(4)} of range ${range}, capped at ${tunable.maxStepFraction * 100}%`,
    mode,
  };
}

/** Applies a proposal to a tunable, returning the new tunable and the audit event. Never mutates the input. */
export function applyTuning(tunable: Tunable, proposal: TuningProposal, now: number, correlationId = nextId("tune")): { tunable: Tunable; event: EvaraEvent } {
  const updated: Tunable = { ...tunable, current: proposal.to, lastChangedAt: now };
  const event = makeEvent("system.tuning.applied", now, correlationId, { tunableId: tunable.id, from: proposal.from, to: proposal.to, reason: proposal.reason });
  return { tunable: updated, event };
}

/** Reverts a tunable to a prior value (e.g. because outcomes got worse after applying). Same audit trail as apply. */
export function revertTuning(tunable: Tunable, to: number, reason: string, now: number, correlationId = nextId("tune")): { tunable: Tunable; event: EvaraEvent } {
  const updated: Tunable = { ...tunable, current: to, lastChangedAt: now };
  const event = makeEvent("system.tuning.reverted", now, correlationId, { tunableId: tunable.id, from: tunable.current, to, reason });
  return { tunable: updated, event };
}
