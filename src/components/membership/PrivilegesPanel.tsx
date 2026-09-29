import { useQuery } from "convex/react"
import { BarChart3, Gem, ScrollText, ShieldCheck, Trophy } from "lucide-react"
import { api } from "../../../convex/_generated/api"

const ACTION_LABEL: Record<string, string> = {
  tier_created: "Tier established",
  tier_changed: "Tier changed",
  rewarded: "Challenge reward",
  updated: "Profile updated",
}

/**
 * Feature gates + the privilege audit trail for the current tier. The gates
 * reuse membership.getSovereignFeatures (already shown, differently, inside
 * SovereignConsole). The audit log is membership.getSovereignAudit — a real
 * query that existed with nothing rendering it anywhere in the app.
 */
export function PrivilegesPanel() {
  const features = useQuery(api.membership.getSovereignFeatures)
  const audit = useQuery(api.membership.getSovereignAudit) ?? []

  if (!features) return <p className="text-sm text-muted-foreground">Loading…</p>

  const gates = [
    { label: "Hide-from list", value: `${features.hideFromLimit} active`, icon: ShieldCheck },
    { label: "Podium multiplier", value: `${features.pointsPlacementMultiplier}× Nexa points`, icon: Trophy },
    { label: "Pinned showcase media", value: `${features.maxPinnedMedia} slot(s)`, icon: Gem },
    { label: "Discovery boost", value: features.discoveryBoost ? "Enabled" : "Not on this tier", icon: BarChart3 },
  ]

  return (
    <div>
      <p className="text-[10px] uppercase tracking-[0.2em] text-accent">Privileges</p>
      <h2 className="mt-2 font-display text-3xl tracking-[-0.03em]">What your tier unlocks — and why.</h2>
      <p className="mt-3 max-w-2xl text-sm leading-6 text-muted-foreground">
        Feature gates are enforced server-side against your tier, not just hidden in the UI. Everything below reflects your account right now — {features.tier.replace("_", "-")}.
      </p>

      <div className="mt-7 grid gap-3 md:grid-cols-4">
        {gates.map(({ label, value, icon: Icon }) => (
          <div key={label} className="border border-border bg-card p-5">
            <Icon className="h-4 w-4 text-accent" />
            <p className="mt-4 text-[9px] uppercase tracking-[0.14em] text-muted-foreground">{label}</p>
            <p className="mt-1 text-sm">{value}</p>
          </div>
        ))}
      </div>

      <div className="mt-7 border border-border bg-card p-6 md:p-8">
        <div className="flex items-center gap-3"><ScrollText className="h-5 w-5 text-accent" /><h3 className="font-display text-xl">Privilege audit trail</h3></div>
        <p className="mt-2 text-xs leading-5 text-muted-foreground">A record of tier changes and rewards tied to your account — for your own visibility, not just an admin's.</p>
        <div className="mt-5 flex flex-col divide-y divide-border">
          {audit.length === 0 && <p className="py-6 text-sm text-muted-foreground">No privilege events recorded yet.</p>}
          {audit.map((entry: any) => (
            <div key={entry._id} className="flex items-center justify-between gap-4 py-3">
              <div>
                <p className="text-sm">{ACTION_LABEL[entry.action] ?? entry.action}</p>
                <p className="mt-1 text-[10px] uppercase tracking-[0.1em] text-muted-foreground">{entry.feature.replace(/_/g, " ")} · {entry.tier.replace("_", "-")}</p>
              </div>
              <span className="whitespace-nowrap text-[10px] text-muted-foreground">{new Date(entry.createdAt).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" })}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
