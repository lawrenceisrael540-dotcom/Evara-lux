import { createFileRoute } from "@tanstack/react-router"
import { useQuery } from "convex/react"
import { api } from "../../convex/_generated/api"
import { SecurityCenter } from "../components/security/SecurityCenter"
import { LegalCenter } from "../components/legal/LegalCenter"
import { PrivilegesPanel } from "../components/membership/PrivilegesPanel"

export const Route = createFileRoute("/account")({ component: AccountPage })

function AccountPage() {
  const membership = useQuery(api.membership.getMyMembership)
  return <section className="mx-auto max-w-[1200px] space-y-8 px-5 py-10 md:px-10">
    <div><p className="text-[10px] uppercase tracking-[.22em] text-accent">EVARA·LUX / ACCOUNT</p><h1 className="mt-2 font-display text-5xl">Your House.</h1><p className="mt-3 text-sm text-muted-foreground">Identity, membership, security and privacy now share one account surface.</p></div>
    <div className="border border-border bg-card p-6"><p className="text-[10px] uppercase tracking-[.16em] text-muted-foreground">Membership</p><p className="mt-2 font-display text-3xl">{membership?.tier?.replaceAll("_"," ") ?? "Obsidian"}</p><p className="mt-2 text-sm text-muted-foreground">{membership?.points ?? 0} NEXA points</p></div>
    <PrivilegesPanel />
    <SecurityCenter />
    <LegalCenter />
  </section>
}
