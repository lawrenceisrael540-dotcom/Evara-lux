import { useState } from "react"
import { useMutation, useQuery } from "convex/react"
import { api } from "../../../convex/_generated/api"

export function LegalCenter() {
  const consents = useQuery(api.legal.getMyConsents)
  const deletion = useQuery(api.legal.getMyDeletionRequest)
  const requestDeletion = useMutation(api.legal.requestDataDeletion)
  const [reason, setReason] = useState("")
  const [notice, setNotice] = useState("")

  async function submitDeletion() {
    const result = await requestDeletion({ reason: reason.trim() || undefined })
    setNotice(result.ok ? "Deletion request submitted for review." : result.message)
    if (result.ok) setReason("")
  }

  return (
    <section className="mx-auto max-w-4xl space-y-5">
      <div className="border border-border bg-card p-6 md:p-8">
        <p className="text-[10px] uppercase tracking-[0.22em] text-accent">EVARA·LUX / LEGAL & PRIVACY</p>
        <h1 className="mt-2 font-display text-3xl md:text-4xl">Privacy & account rights.</h1>
        <p className="mt-3 max-w-2xl text-sm leading-6 text-muted-foreground">
          Review the consent records associated with your account and request deletion of your personal account data.
          Business identity, governing-law and refund-policy fields remain configuration items until the operator supplies the final legal facts.
        </p>
      </div>

      <div className="border border-border bg-card p-6">
        <h2 className="font-display text-2xl">Your consent history</h2>
        <div className="mt-5 divide-y divide-border border border-border">
          {(consents ?? []).length === 0 ? (
            <p className="p-5 text-sm text-muted-foreground">No account-level consent records are available yet.</p>
          ) : (
            (consents ?? []).map((item, index) => (
              <div key={index} className="flex flex-wrap items-center justify-between gap-3 p-4">
                <span className="text-sm">{item.kind.replaceAll("_", " ")}</span>
                <span className="text-xs text-muted-foreground">
                  v{item.version} · {new Date(item.acceptedAt).toLocaleString()}
                </span>
              </div>
            ))
          )}
        </div>
      </div>

      <div className="border border-border bg-card p-6">
        <h2 className="font-display text-2xl">Delete my account data</h2>
        <p className="mt-2 text-sm leading-6 text-muted-foreground">
          Requests are queued for review so records that must be retained for legitimate operational or financial obligations can be reconciled before deletion.
        </p>
        {deletion && (
          <p className="mt-4 border border-border p-3 text-xs">
            Current request: <strong>{deletion.status.replaceAll("_", " ")}</strong> · {new Date(deletion.requestedAt).toLocaleString()}
          </p>
        )}
        {!deletion || deletion.status === "rejected" || deletion.status === "completed" ? (
          <>
            <textarea
              value={reason}
              onChange={(event) => setReason(event.target.value)}
              maxLength={500}
              placeholder="Optional reason for the request"
              className="mt-5 min-h-28 w-full border border-border bg-background p-4 text-sm outline-none focus:border-accent"
            />
            <button type="button" onClick={() => void submitDeletion()} className="mt-3 bg-foreground px-5 py-3 text-[10px] uppercase tracking-[0.14em] text-background">
              Request deletion
            </button>
          </>
        ) : null}
      </div>

      {notice && (
        <button type="button" onClick={() => setNotice("")} className="fixed bottom-5 left-1/2 z-50 -translate-x-1/2 border border-border bg-card px-5 py-3 text-xs shadow-2xl">
          {notice} ×
        </button>
      )}
    </section>
  )
}
