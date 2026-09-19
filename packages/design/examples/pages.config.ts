import type { PageConfig } from "../src/design/index.js";

/**
 * Example registry. Replace with the real routes after the repository audit
 * (see docs/06-roadmap.md, phase 1). Pages are data, not hand-built templates.
 */
export const pages: readonly PageConfig[] = [
  {
    id: "executive-overview",
    route: "/executive",
    section: "admin",
    name: "Executive overview",
    meaning: "The state of the business, seen from above.",
    emotion: "calm authority",
    auraId: "obsidian-command",
    purpose: "Decide where to spend attention this week.",
    userIntent: "Understand what changed and what needs a decision.",
    dataType: "revenue, margin, risk signals",
    composition: { compact: "vertical-story", expanded: "layered-depth" },
    story: ["opening", "discovery", "decision"],
    navigation: "spine",
    insights: [
      {
        id: "margin-vs-revenue",
        statement: "Revenue rose 12%, but contribution margin fell.",
        dataSource: "orders + cost ledger, trailing 30 days",
        surface: "annotation",
        dismissible: true,
      },
    ],
  },
  {
    id: "ledger",
    route: "/finance",
    section: "admin",
    name: "Ledger",
    meaning: "Every movement of money, accounted for.",
    emotion: "trust",
    auraId: "midnight-ledger",
    purpose: "Reconcile and audit financial activity.",
    userIntent: "Find a transaction, verify a balance.",
    dataType: "transactions, balances",
    composition: { compact: "command-center", expanded: "spatial-data" },
    story: ["exploration", "interaction", "action"],
    navigation: "command-palette",
  },
  {
    id: "operations-flow",
    route: "/operations",
    section: "admin",
    name: "Operations flow",
    meaning: "Work moving through the system.",
    emotion: "momentum",
    auraId: "flowline-operations",
    purpose: "Spot the bottleneck before it grows.",
    userIntent: "See where work is stuck.",
    dataType: "queues, suppliers, fulfilment",
    composition: { compact: "vertical-story", expanded: "constellation" },
    story: ["opening", "exploration", "action"],
    navigation: "rail",
    insights: [
      {
        id: "supplier-bottleneck",
        statement: "Supplier B is the current bottleneck.",
        dataSource: "fulfilment queue, last 7 days",
        surface: "margin",
        dismissible: true,
      },
    ],
  },
] as const;
