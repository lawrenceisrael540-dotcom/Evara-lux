import { useState } from "react"
import { useMutation, useQuery } from "convex/react"
import { Link } from "@tanstack/react-router"
import { Crown, Flame, Gauge, Gem, Shield, Swords, Trophy, Users, Zap } from "lucide-react"
import { api } from "../../../convex/_generated/api"

const rankLadder=[
  ["E","Unawakened",0],["D","Initiate",600],["C","Awakened",800],["B","Vanguard",1000],
  ["A","Elite",1250],["S","Sovereign Hunter",1500],["SS","Ascendant",1800],["SSS","Transcendent",2100],["MONARCH","Thronebreaker",2400]
]
const rarityGlow:Record<string,string>={common:"border-white/10",rare:"border-cyan-400/30",epic:"border-violet-400/40",mythic:"border-fuchsia-400/50",sovereign:"border-[#e8c576]/70"}

export function AscensionOS(){
 const data=useQuery(api.arcana.getAscensionOS)
 const awaken=useMutation(api.arcana.awakenPowerUp)
 const [tab,setTab]=useState<"rank"|"power"|"guild">("rank")
 const [busy,setBusy]=useState<string|null>(null)
 if(!data) return <div className="min-h-[60vh] bg-[#050506] text-white grid place-items-center"><div className="text-center"><Gauge className="mx-auto h-7 w-7 animate-pulse text-[#e8c576]"/><p className="mt-4 text-[9px] uppercase tracking-[.25em] text-white/40">Initializing Ascension OS</p></div></div>
 const ranking=data.ranking
 const resources=data.resources
 const leaderboard=data.leaderboard??[]
 const mastery=data.mastery??[]
 const powerups=data.powerups??[]
 const owned=data.owned??[]
 const rankIndex=Math.max(0,rankLadder.findIndex(x=>x[0]===ranking?.division))
 const next=rankLadder[Math.min(rankIndex+1,rankLadder.length-1)]
 const progress=next && ranking ? Math.min(100,Math.max(0,((ranking.rating-Number(rankLadder[rankIndex][2]))/(Number(next[2])-Number(rankLadder[rankIndex][2])))*100)) : 100
 const awakenOne=async(key:string)=>{setBusy(key);try{await awaken({key})}finally{setBusy(null)}}
 return <section className="bg-[#050506] text-white border-y border-white/10">
  <div className="mx-auto max-w-7xl px-4 py-10 md:px-8">
   <div className="flex flex-col gap-5 md:flex-row md:items-end md:justify-between">
    <div><div className="flex items-center gap-2 text-[9px] uppercase tracking-[.28em] text-[#e8c576]"><Flame className="h-3.5 w-3.5"/> Ascension OS · Season {data.season}</div><h2 className="mt-2 font-display text-4xl tracking-[-.04em] md:text-6xl">POWER HAS A HIERARCHY.</h2><p className="mt-3 max-w-2xl text-xs leading-6 text-white/40">Every run feeds your hunter rating. Every awakening changes your build. Guilds turn individual power into territory.</p></div>
    <Link to="/arena" className="border border-[#e8c576]/30 px-5 py-3 text-[9px] uppercase tracking-[.2em] hover:bg-[#e8c576]/5">Enter Arena ↗</Link>
   </div>

   <div className="mt-7 grid gap-3 md:grid-cols-4">
    <div className="border border-[#e8c576]/30 bg-[#e8c576]/5 p-5 md:col-span-2"><div className="flex items-center justify-between"><div><p className="text-[9px] uppercase tracking-[.2em] text-white/35">Current ascension</p><p className="mt-2 font-display text-4xl">{ranking?.division??"E"}</p><p className="mt-1 text-xs text-[#e8c576]">{ranking?.title??"Unawakened"}</p></div><Crown className="h-8 w-8 text-[#e8c576]"/></div><div className="mt-5 h-1 bg-white/10"><div className="h-full bg-[#e8c576]" style={{width:progress+"%"}}/></div><div className="mt-2 flex justify-between text-[8px] uppercase tracking-[.16em] text-white/30"><span>{ranking?.rating??500} rating</span><span>{next?.[0]??"MAX"} threshold</span></div></div>
    <div className="border border-white/10 p-5"><p className="text-[9px] uppercase tracking-[.2em] text-white/35">Season record</p><p className="mt-2 font-display text-3xl">{ranking?.wins??0}<span className="text-white/20"> / {ranking?.losses??0}</span></p><p className="mt-1 text-[9px] uppercase text-[#e8c576]">{ranking?.streak??0} win streak</p></div>
    <div className="border border-white/10 p-5"><p className="text-[9px] uppercase tracking-[.2em] text-white/35">Core resources</p><div className="mt-3 flex gap-4 text-xs"><span><Gem className="mb-1 h-4 w-4 text-[#e8c576]"/>{resources?.essence??0}</span><span><Zap className="mb-1 h-4 w-4 text-violet-300"/>{resources?.shards??0}</span><span><Shield className="mb-1 h-4 w-4 text-cyan-300"/>{resources?.cores??0}</span></div></div>
   </div>

   <div className="mt-8 flex gap-1 overflow-x-auto border-b border-white/10">
    {([["rank","Rank Nexus"],["power","Power Forge"],["guild","Guild OS"]] as const).map(([id,label])=><button key={id} onClick={()=>setTab(id)} className={"shrink-0 px-5 py-3 text-[9px] uppercase tracking-[.18em] "+(tab===id?"border-b border-[#e8c576] text-[#e8c576]":"text-white/35")}>{label}</button>)}
   </div>

   {tab==="rank"&&<div className="mt-6 grid gap-5 lg:grid-cols-[.85fr_1.15fr]">
    <div className="border border-white/10 bg-white/[.02] p-6"><p className="flex items-center gap-2 text-[9px] uppercase tracking-[.2em] text-[#e8c576]"><Trophy className="h-4 w-4"/> Ascension ladder</p><div className="mt-5 space-y-2">{rankLadder.map((r,i)=><div key={String(r[0])} className={"flex items-center justify-between border p-3 "+(i===rankIndex?"border-[#e8c576]/50 bg-[#e8c576]/5":"border-white/5")}><div className="flex items-center gap-3"><span className="w-10 font-display text-lg">{r[0]}</span><span className="text-xs">{r[1]}</span></div><span className="text-[8px] text-white/30">{r[2]} RP</span></div>)}</div></div>
    <div className="border border-white/10 bg-white/[.02] p-6"><p className="flex items-center gap-2 text-[9px] uppercase tracking-[.2em] text-[#e8c576]"><Swords className="h-4 w-4"/> Global ranking</p><div className="mt-5 space-y-2">{leaderboard.length?leaderboard.map((x:any,i:number)=><div key={String(x._id)} className="grid grid-cols-[40px_1fr_auto] items-center border border-white/5 p-3"><span className="font-display text-lg text-white/30">#{i+1}</span><div><p className="text-xs">{x.title}</p><p className="mt-1 text-[8px] uppercase tracking-[.14em] text-white/30">{x.division} · {x.wins}W / {x.losses}L</p></div><span className="text-xs text-[#e8c576]">{x.rating}</span></div>):<p className="py-12 text-center text-xs text-white/30">Your season begins with your first ranked run.</p>}</div></div>
   </div>}

   {tab==="power"&&<div className="mt-6 grid gap-3 md:grid-cols-2 xl:grid-cols-3">{powerups.map((m:any)=><div key={m.key} className={"border bg-white/[.02] p-5 "+rarityGlow["rare"]}><div className="flex items-start justify-between"><div><p className="text-sm">{m.name}</p><p className="mt-1 text-[8px] uppercase tracking-[.16em] text-[#e8c576]">{m.rarity} · Lv.{m.level}</p></div><button disabled={busy===m.key} onClick={()=>void awakenOne(m.key)} className="border border-[#e8c576]/30 px-3 py-2 text-[8px] uppercase tracking-[.14em]">{busy===m.key?"Awakening":"Awaken"}</button></div><div className="mt-5 h-1 bg-white/10"><div className="h-full bg-[#e8c576]" style={{width:Math.min(100,(mastery.find((x:any)=>x.powerUpKey===m.key)?.masteryXp??0)/20)+"%"}}/></div></div>)}{data.mastery?.length===0&&<div className="md:col-span-2 xl:col-span-3 border border-white/10 p-8 text-center text-xs text-white/30">Use a power-up in the Arena to begin mastery. Higher awakenings consume Essence and generate Cores.</div>}</div>}

   {tab==="guild"&&<div className="mt-6 grid gap-5 lg:grid-cols-[1fr_.7fr]">
    <div className="border border-white/10 bg-white/[.02] p-6"><p className="flex items-center gap-2 text-[9px] uppercase tracking-[.2em] text-[#e8c576]"><Users className="h-4 w-4"/> Territory command</p><p className="mt-3 text-xs leading-6 text-white/40">Sovereign-Gilded owners can command guild territory and appoint officers. Everyone else can join guilds, build power and earn standing through play.</p><div className="mt-5 grid gap-2 sm:grid-cols-2">{owned.map((g:any)=><div key={String(g._id)} className="border border-[#e8c576]/20 bg-[#e8c576]/5 p-4"><p className="text-sm">{g.name}</p><p className="mt-1 text-[9px] uppercase tracking-[.15em] text-white/30">{g.territory}</p><span className="mt-4 inline-block text-[8px] uppercase tracking-[.15em] text-[#e8c576]">Sovereign territory</span></div>)}{owned.length===0&&<div className="sm:col-span-2 border border-white/5 p-6 text-xs text-white/30">No commanded territory yet. Join a guild through its roster or unlock Gilded command rights.</div>}</div></div>
    <div className="border border-white/10 bg-white/[.02] p-6"><p className="text-[9px] uppercase tracking-[.2em] text-[#e8c576]">Your guild links</p><div className="mt-4 space-y-2">{(data.memberships??[]).map((m:any)=><div key={String(m._id)} className="flex items-center justify-between border border-white/5 p-3"><span className="text-xs">{m.role}</span><span className="text-[8px] uppercase text-green-300">{m.status}</span></div>)}{data.memberships?.length===0&&<p className="py-8 text-center text-xs text-white/30">No guild allegiance recorded.</p>}</div></div>
   </div>}

   <div className="mt-8 flex items-center gap-3 border border-white/10 bg-white/[.02] p-4 text-[8px] uppercase tracking-[.15em] text-white/30"><Gauge className="h-4 w-4 text-[#e8c576]"/> Mobile-first loop · thumb combat · seasonal ranking · persistent progression · server-authorized guild governance</div>
  </div>
 </section>
}


