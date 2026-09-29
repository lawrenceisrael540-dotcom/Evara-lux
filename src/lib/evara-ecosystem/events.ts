/**
 * Event contracts and a small in-process bus. Engines talk through events, never through each other's internals.
 * Every event carries identity, causation and an idempotency key, so a retry or duplicate webhook is harmless.
 * The bus is the reference behaviour; a queue (Supabase, n8n, SQS) replaces the transport, not the contract.
 */
export const EVENT_TYPES = [
  "customer.created", "customer.updated", "customer.searched", "product.viewed", "product.wishlisted",
  "cart.created", "cart.abandoned", "order.created", "order.paid", "order.cancelled", "order.refunded",
  "payment.received", "payment.failed", "withdrawal.requested", "withdrawal.completed", "withdrawal.failed",
  "reward.earned", "loyalty.changed", "nexa.moment.arrived", "nexa.moment.claimed", "card.evolved",
  "inventory.low", "supplier.changed", "support.requested", "risk.detected",
  "system.health.checked", "system.heal.performed", "system.handler.quarantined",
  "system.handler.resumed", "system.tuning.proposed", "system.tuning.applied", "system.tuning.reverted",
] as const;
export type EventType = (typeof EVENT_TYPES)[number];

export interface EvaraEvent<P = Record<string, unknown>> {
  id: string;
  type: EventType;
  occurredAt: number;
  actor: string;
  source: string;
  correlationId: string;
  causationId: string | null;
  idempotencyKey: string;
  schemaVersion: 1;
  payload: P;
}

export function validateEvent(e: Partial<EvaraEvent>): string[] {
  const p: string[] = [];
  if (!e.id) p.push("id is required");
  if (!e.type || !(EVENT_TYPES as readonly string[]).includes(e.type)) p.push(`unknown event type "${String(e.type)}"`);
  if (typeof e.occurredAt !== "number" || !Number.isFinite(e.occurredAt)) p.push("occurredAt must be epoch ms");
  if (!e.actor) p.push("actor is required");
  if (!e.source) p.push("source is required");
  if (!e.correlationId) p.push("correlationId is required");
  if (!e.idempotencyKey) p.push("idempotencyKey is required");
  if (e.schemaVersion !== 1) p.push("schemaVersion must be 1");
  if (!e.payload || typeof e.payload !== "object") p.push("payload must be an object");
  return p;
}

export type Handler = (e: EvaraEvent) => Promise<void> | void;

export interface DeadLetter { event: EvaraEvent; handler: string; attempts: number; error: string; at: number }

export interface PublishReport {
  delivered: string[];
  duplicates: string[];
  deadLettered: string[];
}

export class EventBus {
  private readonly handlers = new Map<EventType, { name: string; fn: Handler }[]>();
  private readonly done = new Set<string>();
  readonly deadLetters: DeadLetter[] = [];

  constructor(
    private readonly maxAttempts = 3,
    private readonly wait: (ms: number) => Promise<void> = async () => undefined,
    private readonly now: () => number = Date.now,
  ) {}

  subscribe(type: EventType, name: string, fn: Handler): void {
    const list = this.handlers.get(type) ?? [];
    list.push({ name, fn });
    this.handlers.set(type, list);
  }

  /** Invalid events are rejected up front. A handler that keeps failing goes to the dead-letter list instead of blocking others. */
  async publish(e: EvaraEvent): Promise<PublishReport> {
    const problems = validateEvent(e);
    if (problems.length) throw new Error(`Invalid event: ${problems.join("; ")}`);
    const report: PublishReport = { delivered: [], duplicates: [], deadLettered: [] };
    for (const h of this.handlers.get(e.type) ?? []) {
      const key = `${h.name}|${e.idempotencyKey}`;
      if (this.done.has(key)) { report.duplicates.push(h.name); continue; }
      let lastError = "";
      let ok = false;
      for (let attempt = 1; attempt <= this.maxAttempts && !ok; attempt++) {
        try { await h.fn(e); ok = true; }
        catch (err) { lastError = err instanceof Error ? err.message : String(err); if (attempt < this.maxAttempts) await this.wait(2 ** attempt * 100); }
      }
      if (ok) { this.done.add(key); report.delivered.push(h.name); }
      else { this.deadLetters.push({ event: e, handler: h.name, attempts: this.maxAttempts, error: lastError, at: this.now() }); report.deadLettered.push(h.name); }
    }
    return report;
  }
}
