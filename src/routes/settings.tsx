import { createFileRoute } from "@tanstack/react-router"
import { useMutation, useQuery } from "convex/react"
import { api } from "../../convex/_generated/api"

export const Route = createFileRoute("/settings")({ component: SettingsPage })
function SettingsPage(){
 const p=useQuery(api.privacy.getMyPrivacy)
 const save=useMutation(api.privacy.updateMyPrivacy)
 const toggle=async(k:"showFollowers"|"showFollowing"|"showLikes"|"showComments"|"showReshares"|"showViews")=>{if(!p)return;await save({...p,[k]:!p[k]})}
 return <section className="mx-auto max-w-3xl px-5 py-12 md:px-10"><p className="text-[10px] uppercase tracking-[.22em] text-accent">EVARA·LUX / SETTINGS</p><h1 className="mt-2 font-display text-5xl">Control your visibility.</h1><div className="mt-8 divide-y divide-border border border-border bg-card">{(["showFollowers","showFollowing","showLikes","showComments","showReshares","showViews"] as const).map(k=><button key={k} onClick={()=>void toggle(k)} className="flex w-full items-center justify-between p-5 text-left"><span className="text-sm">{k.replace("show","Show ")}</span><span className={p?.[k]?"text-accent":"text-muted-foreground"}>{p?.[k]?"Visible":"Hidden"}</span></button>)}</div></section>
}
