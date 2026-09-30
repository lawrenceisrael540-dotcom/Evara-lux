import { createFileRoute } from "@tanstack/react-router"
import { useMutation, useQuery } from "convex/react"
import { api } from "../../convex/_generated/api"

export const Route = createFileRoute("/notifications")({ component: NotificationsPage })

function NotificationsPage() {
  const items = useQuery(api.notifications.listMine,{limit:50}) ?? []
  const markRead = useMutation(api.notifications.markRead)
  const markAll = useMutation(api.notifications.markAllRead)
  return <section className="mx-auto max-w-4xl px-5 py-12 md:px-10">
    <div className="flex items-end justify-between gap-4 border-b border-border pb-7"><div><p className="text-[10px] uppercase tracking-[.22em] text-accent">EVARA·LUX / SIGNALS</p><h1 className="mt-2 font-display text-4xl">Notifications.</h1></div><button onClick={()=>void markAll()} className="border border-border px-4 py-2 text-[10px] uppercase tracking-[.14em]">Mark all read</button></div>
    <div className="mt-5 divide-y divide-border border border-border">{items.length===0?<p className="p-6 text-sm text-muted-foreground">No notifications yet.</p>:items.map((n:any)=><button key={n._id} onClick={()=>void markRead({notificationId:n._id})} className="block w-full p-5 text-left hover:bg-card"><div className="flex justify-between gap-4"><span className="text-sm">{n.title}</span><span className="text-[10px] uppercase text-muted-foreground">{n.readAt?"Read":"New"}</span></div><p className="mt-2 text-xs leading-5 text-muted-foreground">{n.body}</p></button>)}</div>
  </section>
}
