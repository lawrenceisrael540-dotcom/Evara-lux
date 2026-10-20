# EVARA-LUX revenue and automation operating model

Status: proposed operating design; no profit, conversion, supplier margin, or customer-demand assumptions have been verified yet.

## Principle

Optimize contribution margin and customer lifetime value, not gross sales alone. No AI agent may invent product prices, availability, discounts, delivery promises, reviews, or customer entitlements. Humans retain approval for high-risk financial, policy, and production changes.

## Revenue loop

1. Acquire: track source/UTM, landing page, consent, and cost per qualified visitor.
2. Discover: measure search-to-product click, recommendation engagement, and add-to-cart rate.
3. Convert: measure checkout completion, payment authorization/capture, cancellation, refund, and chargeback rates.
4. Fulfil: ingest supplier status, shipping events, delivery exceptions, and actual landed cost.
5. Retain: consent-based post-purchase messaging, loyalty progress, replenishment or related recommendations only when relevant.
6. Learn: compare cohorts and experiments against a control; roll back variants that reduce contribution margin or trust.

## Minimum unit-economics ledger

For each order, calculate:
- net merchandise revenue after discounts and refunds
- minus supplier/product cost and shipping subsidy
- minus payment-processing and marketplace fees
- minus expected refunds, returns, chargebacks, and fraud loss
- minus variable fulfilment, support, and acquisition cost
= contribution margin per order

Do not scale paid acquisition until contribution margin is positive or an explicitly approved, time-limited acquisition investment has a measurable payback hypothesis. Track cohort contribution margin and repeat purchase, not only revenue.

## Safe automation boundaries

- Catalog agent: may draft normalized product data from verified supplier fields; must not publish fabricated claims or alter price/margin floors.
- Pricing agent: recommend only; enforce a deterministic minimum-margin rule in server-side code; require approval for exceptions.
- Marketing agent: only message opted-in recipients; respect unsubscribe/suppression, frequency caps, and quiet hours; run holdout tests.
- Support agent: read-only by default; refunds, account changes, and order cancellations require authenticated policy checks and audit trails.
- Finance/reconciliation agent: read-only reconciliation first; never initiate payouts or move balances without explicit authorization, idempotency, limits, and independent verification.
- AI concierge: retrieve live catalog, member entitlements, and policy facts from authoritative systems; clearly identify unavailable or unverified information.

## Dashboards and alerts

Daily: conversion funnel, contribution margin, payment failures, refunds, chargebacks, supplier exceptions, message deliverability, queue failures, and spend.
Weekly: cohort repeat purchase, CAC/payback, product/category margin, experiment results, membership retention, support resolution time, and AI answer-quality audits.
Alert on negative margin after refunds/fees, unusual payment or refund velocity, inventory/supplier feed staleness, failed webhook processing, elevated 5xx/latency, sudden deliverability decline, and authorization anomalies.

## Required before declaring profitability

- verified supplier cost, shipping cost, fee schedules, tax and refund assumptions
- event instrumentation and order/payment reconciliation
- baseline traffic, conversion, retention, and acquisition data
- experiment design with control cohorts and minimum sample sizes
- finance sign-off on margin formula and exception policy

## Release gates

No production automation that sends customer communications, changes prices, grants memberships, issues refunds, changes financial balances, or modifies access control until its permission scope, idempotency, audit logs, failure recovery, and rollback behavior are tested.
