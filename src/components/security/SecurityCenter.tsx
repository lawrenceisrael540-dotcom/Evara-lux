import { useQuery } from "convex/react"
import { ShieldCheck, KeyRound, Smartphone } from "lucide-react"
import { api } from "../../../convex/_generated/api"

export function SecurityCenter() {
  const security = useQuery(api.security.getMySecurity)
  const passkeys = useQuery(api.passkey.getMine)

  if (!security) return <div className="p-6 text-sm text-muted-foreground">Loading security controls…</div>

  return (
    <section className="mx-auto max-w-4xl space-y-5">
      <div className="border border-border bg-card p-6 md:p-8">
        <p className="text-[10px] uppercase tracking-[0.22em] text-accent">EVARA·LUX / SECURITY</p>
        <h1 className="mt-2 font-display text-3xl md:text-4xl">Account protection.</h1>
        <p className="mt-3 max-w-2xl text-sm leading-6 text-muted-foreground">
          Security state is read from the authenticated backend. Sensitive operations remain server-authorized rather than trusting client-side tier or identity fields.
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <StatusCard icon={<ShieldCheck className="h-5 w-5 text-accent" />} title="Email" value={security.ok && security.emailVerified ? "Verified" : "Unverified"} />
        <StatusCard icon={<Smartphone className="h-5 w-5 text-accent" />} title="2FA" value={security.ok && security.twoFactorEnabled ? "Enabled" : "Not enabled"} />
        <StatusCard icon={<KeyRound className="h-5 w-5 text-accent" />} title="Passkeys" value={String(passkeys?.length ?? 0)} />
      </div>

      <div className="border border-border bg-card p-6">
        <h2 className="font-display text-2xl">Passkeys</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          Registered credentials are stored server-side with their public keys; private authenticator keys never enter EVARA-LUX.
        </p>
        <div className="mt-5 divide-y divide-border border border-border">
          {(passkeys ?? []).length === 0 ? (
            <p className="p-5 text-sm text-muted-foreground">No passkeys registered.</p>
          ) : (
            (passkeys ?? []).map((key) => (
              <div key={key.id} className="flex items-center justify-between gap-4 p-4">
                <div><p className="text-sm">{key.name}</p><p className="text-xs text-muted-foreground">{key.deviceType ?? "Authenticator"}{key.backedUp ? " · backed up" : ""}</p></div>
                <span className="text-[10px] uppercase tracking-[0.12em] text-accent">Active</span>
              </div>
            ))
          )}
        </div>
      </div>
    </section>
  )
}

function StatusCard({ icon, title, value }: { icon: React.ReactNode; title: string; value: string }) {
  return <div className="border border-border bg-card p-5"><div className="flex items-center gap-3">{icon}<span className="text-[10px] uppercase tracking-[0.16em] text-muted-foreground">{title}</span></div><p className="mt-6 font-display text-2xl">{value}</p></div>
}
