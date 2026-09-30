import { Link } from "@tanstack/react-router"
import { useQuery } from "convex/react"
import { Activity, Bot, Gamepad2, Gem, LockKeyhole, ShoppingBag, Users } from "lucide-react"
import { api } from "../../convex/_generated/api"

const systems = [
  ["/catalog", "Commerce", ShoppingBag, "Products, cart and checkout"],
  ["/dashboard/social", "Social", Users, "Feed, stories and community"],
  ["/dashboard/ai", "Intelligence", Bot, "AI command and workflows"],
  ["/arena", "Arcana", Gamepad2, "Progression and game systems"],
  ["/account", "Identity", LockKeyhole, "Membership, security and rights"],
  ["/nexa", "NEXA", Gem, "Points and progression"],
] as const

export function EcosystemHub() {
  const overview = useQuery(api.dashboard.getMyOverview)
  const membership = useQuery(api.membership.getMyMembership)
  const notifications = useQuery(api.notifications.unreadCount)
  return <section className="mx-auto max-w-[1440px] px-5 py-12 md:px-10">
    <div className="border border-border bg-card p-6 md:p-8">
      <div className="flex flex-col gap-5 md:flex-row md:items-end md:justify-between">
        <div><p className="flex items-center gap-2 text-[10px] uppercase tracking-[.22em] text-accent"><Activity className="h-3.5 w-3.5"/> EVARA·LUX / COMMAND</p><h1 className="mt-2 font-display text-4xl md:text-5xl">Everything in one house.</h1><p className="mt-3 max-w-2xl text-sm leading-6 text-muted-foreground">A shared control surface connecting commerce, social, intelligence, identity, membership and Arcana through the same authenticated runtime.</p></div>
        <div className="grid grid-cols-3 gap-2 text-center"><Metric label="Orders" value={overview?.ok ? overview.orders : 0}/><Metric label="Wishlist" value={overview?.ok ? overview.wishlist : 0}/><Metric label="Unread" value={notifications ?? 0}/></div>
      </div>
      <div className="mt-7 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">{systems.map(([to,title,Icon,copy])=><Link key={to} to={to} className="group border border-border p-5 transition hover:border-accent"><div className="flex items-center justify-between"><Icon className="h-5 w-5 text-accent"/><span className="text-[9px] uppercase tracking-[.14em] text-muted-foreground">Open</span></div><h2 className="mt-10 font-display text-2xl">{title}</h2><p className="mt-2 text-xs text-muted-foreground">{copy}</p></Link>)}</div>
      <div className="mt-5 flex flex-wrap gap-3 border-t border-border pt-5 text-xs text-muted-foreground"><span>Tier: <strong className="text-foreground">{membership?.tier?.replaceAll("_"," ") ?? "obsidian"}</strong></span><span>•</span><span>NEXA: <strong className="text-foreground">{membership?.points ?? 0}</strong></span><span>•</span><span>Backend: <strong className="text-accent">Convex connected</strong></span></div>
    </div>
  </section>
}
function Metric({label,value}:{label:string,value:number}){return <div className="border border-border px-3 py-2"><p className="text-[9px] uppercase tracking-[.12em] text-muted-foreground">{label}</p><p className="mt-1 font-display text-xl">{value}</p></div>}
