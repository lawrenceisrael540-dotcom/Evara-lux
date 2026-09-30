import { createFileRoute } from "@tanstack/react-router"
import { useQuery } from "convex/react"
import { api } from "../../convex/_generated/api"
export const Route = createFileRoute("/u/$username")({ component: ProfilePage })
function ProfilePage(){const {username}=Route.useParams();const p=useQuery(api.privacy.getPublicProfile,{username});if(p===undefined)return <div className="p-12">Loading profile…</div>;if(!p)return <div className="p-12">Profile not found.</div>;return <section className="mx-auto max-w-4xl px-5 py-12 md:px-10"><p className="text-[10px] uppercase tracking-[.22em] text-accent">PROFILE</p><h1 className="mt-2 font-display text-5xl">@{p.username}</h1><p className="mt-2 text-sm text-muted-foreground">{p.displayName??"EVARA member"}</p><p className="mt-8 border border-border p-5 text-sm">{p.access==="full"?"Public profile access granted.":"This profile is protected."}</p></section>}
