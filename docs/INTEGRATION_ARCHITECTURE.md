# EVARA-LUX integration contract

## Provider boundaries

- GitHub is the source of truth for application code.
- Convex owns the application runtime data model and server-side authorization.
- Supabase is accessed only through the existing server-only Convex integration.
- Resend is the primary transactional email provider.
- Vercel is the deployment target; production origins are explicitly allowlisted.
- Paystack remains the payment provider for the existing NGN payment flows.
- CJ Dropshipping remains a server-only fulfillment/catalog integration.

## AI routing

convex/aiProvider.ts is provider-neutral and uses an OpenAI-compatible chat-completions contract.

Required: AI_API_URL, AI_API_KEY, AI_DEFAULT_MODEL.
Optional: AI_PREMIUM_MODEL.

Members at canonical membership rank 3 or higher use AI_PREMIUM_MODEL when configured; otherwise the default model is used. Every request is written to aiRuns and traceEvents.

## Resend

Required: RESEND_API_KEY and RESEND_FROM_EMAIL.
Optional: RESEND_FROM_NAME.

Authentication verification mail and application notifications now use Resend first. A legacy notification endpoint remains only as migration fallback.

## Legal configuration still intentionally open

The code provides consent history and account-deletion request handling, but these business facts must be supplied before publication:
- legal company/entity name
- registered/business address
- support contact
- governing jurisdiction
- final Privacy Policy
- final Terms
- final Cookie Policy
- final Refund/Returns policy and exact applicable periods

No legal identity or policy window is invented by the application.

## Frontend wiring note

The migration branch currently contains reusable frontend components but does not contain a src/routes tree. TanStack Start expects file-based route files under src/routes. The legal and security centers added in this pass are therefore reusable surfaces, not falsely advertised as live URLs until the actual route tree is restored.

Resend's official API supports server-side POST requests to /emails and server-side API-key authentication.