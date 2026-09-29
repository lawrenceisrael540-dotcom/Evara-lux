import { describe, it, expect, vi, beforeEach } from "vitest"

const getAuthUserId = vi.fn()
vi.mock("@convex-dev/auth/server", () => ({ getAuthUserId: (...a: unknown[]) => getAuthUserId(...a) }))
vi.mock("../../convex/_generated/api", () => ({ internal: { customer: { getUserEmail: "customer:getUserEmail" } } }))

import { externalIdFor, resolveCustomer, withCustomer, toApiError, SupabaseError } from "../../convex/supabase"

const SERVICE_KEY = "test-service-role-key-DO-NOT-LEAK"
const USER = "k17abcdefghijklmnop1234567890ab"

function ctxWithEmail(email: string | null = "buyer@example.com") {
  return { runQuery: vi.fn().mockResolvedValue(email) } as any
}

function jsonRes(body: unknown, status = 200) {
  return { ok: status < 400, status, text: async () => JSON.stringify(body) }
}

beforeEach(() => {
  process.env.SUPABASE_URL = "https://example.supabase.co"
  process.env.SUPABASE_SERVICE_ROLE_KEY = SERVICE_KEY
  getAuthUserId.mockReset()
  vi.restoreAllMocks()
})

describe("identity chain", () => {
  it("maps a Convex user id to convex:<id>", () => {
    expect(externalIdFor(USER)).toBe(`convex:${USER}`)
  })

  it("rejects unauthenticated callers without touching Supabase", async () => {
    getAuthUserId.mockResolvedValue(null)
    const fetchMock = vi.fn()
    vi.stubGlobal("fetch", fetchMock)
    const res = await resolveCustomer(ctxWithEmail(), "trace-1")
    expect(res).toMatchObject({ ok: false, code: "UNAUTHENTICATED" })
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it("returns the existing customer without registering again", async () => {
    getAuthUserId.mockResolvedValue(USER)
    const fetchMock = vi.fn().mockResolvedValue(jsonRes([{ id: "cust-1", status: "active", referral_code: "ABCD234567" }]))
    vi.stubGlobal("fetch", fetchMock)
    const res = await resolveCustomer(ctxWithEmail(), "trace-2")
    expect(res).toMatchObject({ ok: true, customer: { customerId: "cust-1", status: "active" } })
    expect(fetchMock).toHaveBeenCalledTimes(1)
    expect(String(fetchMock.mock.calls[0][0])).toContain(`external_auth_id=eq.convex%3A${USER}`)
  })

  it("registers a new user exactly once with the server-derived identity", async () => {
    getAuthUserId.mockResolvedValue(USER)
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(jsonRes([])) // lookup: none
      .mockResolvedValueOnce(jsonRes({ customer_id: "cust-2", new_customer: true })) // register
      .mockResolvedValueOnce(jsonRes([{ id: "cust-2", status: "active", referral_code: "WXYZ234567" }])) // re-read
      .mockResolvedValueOnce(jsonRes({ ok: true })) // welcome coins
      .mockResolvedValueOnce(jsonRes("quiet-fox-1234")) // default handle
      .mockResolvedValueOnce(jsonRes({ changed: true })) // set handle
      .mockResolvedValueOnce(jsonRes([{ id: "cust-2", status: "active", referral_code: "WXYZ234567", username: "quiet-fox-1234" }])) // final read
    vi.stubGlobal("fetch", fetchMock)
    const res = await resolveCustomer(ctxWithEmail(), "trace-3")
    expect(res).toMatchObject({ ok: true, customer: { customerId: "cust-2" } })
    const registerCall = fetchMock.mock.calls[1]
    expect(String(registerCall[0])).toContain("/rpc/evara_customer_register")
    expect(JSON.parse(registerCall[1].body)).toMatchObject({ p_ext: `convex:${USER}`, p_email: "buyer@example.com" })
  })

  it("survives a concurrent first-request race (unique violation)", async () => {
    getAuthUserId.mockResolvedValue(USER)
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(jsonRes([]))
      .mockResolvedValueOnce(jsonRes({ code: "23505", message: "duplicate key" }, 409))
      .mockResolvedValueOnce(jsonRes([{ id: "cust-3", status: "active", referral_code: "QQQQ234567" }]))
      .mockResolvedValueOnce(jsonRes({ ok: true }))
      .mockResolvedValueOnce(jsonRes("quiet-wren-5678"))
      .mockResolvedValueOnce(jsonRes({ changed: true }))
      .mockResolvedValueOnce(jsonRes([{ id: "cust-3", status: "active", referral_code: "QQQQ234567", username: "quiet-wren-5678" }]))
    vi.stubGlobal("fetch", fetchMock)
    const res = await resolveCustomer(ctxWithEmail(), "trace-4")
    expect(res).toMatchObject({ ok: true, customer: { customerId: "cust-3" } })
  })

  it("never auto-links when the email belongs to someone else", async () => {
    getAuthUserId.mockResolvedValue(USER)
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(jsonRes([]))
      .mockResolvedValueOnce(jsonRes({ code: "23505", message: "uq_customers_email" }, 409))
      .mockResolvedValueOnce(jsonRes([]))
    vi.stubGlobal("fetch", fetchMock)
    const res = await resolveCustomer(ctxWithEmail(), "trace-5")
    expect(res).toMatchObject({ ok: false, code: "IDENTITY_CONFLICT" })
  })
})

describe("safe errors", () => {
  it("maps known database errors to stable codes", () => {
    const err = new SupabaseError(400, "P0001", "INSUFFICIENT_FUNDS", "t")
    expect(toApiError(err, "t", "op")).toMatchObject({ ok: false, code: "INSUFFICIENT_FUNDS" })
  })

  it("hides unknown/internal details and never leaks the service key", async () => {
    getAuthUserId.mockResolvedValue(USER)
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error(`boom ${SERVICE_KEY} secret detail`)))
    const logSpy = vi.spyOn(console, "log").mockImplementation(() => {})
    const res = await withCustomer(ctxWithEmail(), "test.op", async () => ({}))
    expect(res).toMatchObject({ ok: false, code: "INTERNAL" })
    expect(JSON.stringify(logSpy.mock.calls)).not.toContain(SERVICE_KEY)
    const serialized = JSON.stringify(res)
    expect(serialized).not.toContain(SERVICE_KEY)
    expect(serialized).not.toContain("secret detail")
    expect(serialized).toContain("Reference:")
  })

  it("passes the server-resolved customer id to handlers", async () => {
    getAuthUserId.mockResolvedValue(USER)
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(jsonRes([{ id: "cust-9", status: "active", referral_code: "AAAA234567" }])))
    const seen = vi.fn()
    const res = await withCustomer(ctxWithEmail(), "test.op", async (c) => {
      seen(c.customerId)
      return { done: true }
    })
    expect(res).toMatchObject({ ok: true, done: true })
    expect(seen).toHaveBeenCalledWith("cust-9")
  })
})
