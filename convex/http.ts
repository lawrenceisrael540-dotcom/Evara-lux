import { httpRouter, httpActionGeneric } from "convex/server"
import { auth } from "./auth"
import { internal } from "./_generated/api"

const http = httpRouter()

auth.addHttpRoutes(http)

http.route({
  path: "/paystack/webhook",
  method: "POST",
  handler: httpActionGeneric(async (ctx, request) => {
    const secret = process.env.PAYSTACK_SECRET_KEY
    const signature = request.headers.get("x-paystack-signature")
    const raw = await request.text()
    if (!secret || !signature) return new Response("Unauthorized", { status: 401 })

    const key = await crypto.subtle.importKey(
      "raw",
      new TextEncoder().encode(secret),
      { name: "HMAC", hash: "SHA-512" },
      false,
      ["sign"],
    )
    const digest = new Uint8Array(await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(raw)))
    const expected = Array.from(digest).map((b) => b.toString(16).padStart(2, "0")).join("")
    if (expected.length !== signature.length || !crypto.subtle) return new Response("Unauthorized", { status: 401 })
    let mismatch = 0
    for (let i = 0; i < expected.length; i++) mismatch |= expected.charCodeAt(i) ^ signature.charCodeAt(i)
    if (mismatch !== 0) return new Response("Unauthorized", { status: 401 })

    let event: any
    try { event = JSON.parse(raw) } catch { return new Response("Bad Request", { status: 400 }) }

    if (event.event === "charge.success") {
      const reference = event.data?.reference
      if (reference) await ctx.runMutation(internal.paystack.markPayment, {
        reference,
        status: "success",
        paidAt: event.data?.paid_at ? Date.parse(event.data.paid_at) : Date.now(),
        metadata: event.data,
      })
    }

    if (event.event === "transfer.success" || event.event === "transfer.failed" || event.event === "transfer.reversed") {
      const reference = event.data?.reference
      const status = event.event === "transfer.success" ? "success" : event.event === "transfer.failed" ? "failed" : "reversed"
      if (reference) await ctx.runMutation(internal.paystack.markTransfer, { reference, status })
    }

    return new Response("OK", { status: 200 })
  }),
})

export default http
