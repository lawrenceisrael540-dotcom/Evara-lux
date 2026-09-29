import { useState } from "react"
import { useMutation, useQuery } from "convex/react"
import { Link } from "@tanstack/react-router"
import { Bolt, Crown, Flame, Gem, Gamepad2, Lock, Sparkles, Swords, Trophy, Zap } from "lucide-react"
import { api } from "../../../convex/_generated/api"
import { AscensionOS } from "./AscensionOS"

const modes = [
  { id:"awakening", name:"AWAKENING", desc:"Build your chain and trigger a breakthrough.", icon:Sparkles },
  { id:"rush", name:"VOID RUSH", desc:"Fast thumb-first score hunt.", icon:Bolt },
  { id:"boss", name:"ABYSS BOSS", desc:"Break the barrier with precision.", icon:Swords },
  { id:"duel", name:"PHANTOM DUEL", desc:"Perfect-timing solo duel.", icon:Gamepad2 },
] as const
const archetypes = [["blade","NOVA BLADE"],["aether","AETHER MAGE"],["phantom","PHANTOM"],["oracle","ORACLE"]]
const cosmetics = [["hair","Midnight Hair"],["eyes","Silver Eyes"],["skin","Moonlit Skin"],["face","Vesper Face"],["outfit","Origin Suit"],["coat","Eclipse Coat"],["weapon","Astral Weapon"],["aura","Ember Aura"],["auraIntensity","Aura Intensity"],["title","Rank Title"],["emblem","Personal Emblem"],["entrance","Entrance FX"],["victory","Victory FX"],["finisher","Finisher FX"],["voiceStyle","Voice Style"],["trail","Energy Trail"]]
const powerNames:Record<string,string>={shadow_step:"Shadow Step",aether_core:"Aether Core",phantom_guard:"Phantom Guard",overdrive:"Overdrive",sovereign_flux:"Sovereign Flux"}

export function ArcanaArena(){
  const data=useQuery(api.arcana.getMyArcana)
  const awaken=useMutation(api.arcana.awaken)
  const customize=useMutation(api.arcana.customize)
  const equip=useMutation(api.arcana.equipPowerUp)
  const start=useMutation(api.arcana.startSession)
  const complete=useMutation(api.arcana.completeSession)
  const claim=useMutation(api.arcana.claimDaily)
  const [codename,setCodename]=useState("")
  const [arch,setArch]=useState("blade")
  const [mode,setMode]=useState<(typeof modes)[number]["id"]>("awakening")
  const [running,setRunning]=useState(false)
  const [score,setScore]=useState(0)
  const [combo,setCombo]=useState(0)
  const [sessionId,setSessionId]=useState<any>(null)
  const [startedAt,setStartedAt]=useState(0)
  const [forge,setForge]=useState(false)
  const [pulse,setPulse]=useState(false)

  const profile=data?.profile
  const tier=data?.tier??"obsidian"
  const limit=data?.customizationLimit??4
  const equipped=data?.powerups?.find((p:any)=>p.equipped)

  async function begin(){
    if(!profile){await awaken({codename:codename||"Wanderer",archetype:arch as any});return}
    const id=await start({mode:mode as any})
    if(!id)return
    setSessionId(id);setStartedAt(Date.now());setScore(0);setCombo(0);setRunning(true)
  }
  async function strike(){
    if(!running)return
    setPulse(true);setScore(s=>s+125+Math.min(1600,combo*24));setCombo(c=>Math.min(999,c+1))
    window.setTimeout(()=>setPulse(false),100)
  }
  async function finish(){
    if(!sessionId||!running)return
    setRunning(false)
    await complete({sessionId,score,combo,durationMs:Date.now()-startedAt})
    setSessionId(null)
  }
  async function saveCosmetic(key:string){
    const values=["01","02","03"]
    const current=String(profile?.customization?.[key]??"01")
    const value=key+"-"+values[(values.indexOf(current.slice(-2))+1)%values.length]
    await customize({customization:{[key]:value}})
  }

  return <div className="min-h-screen bg-[#050506] text-white">
    <style>{`
      @keyframes arcanaFloat{0%,100%{transform:translateY(0)}50%{transform:translateY(-8px)}}
      @keyframes arcanaSpin{to{transform:rotate(360deg)}}
      .arcana-float{animation:arcanaFloat 4s ease-in-out infinite}.arcana-spin{animation:arcanaSpin 8s linear infinite}
    `}</style>
    <div className="relative overflow-hidden border-b border-white/10 bg-[#07070a]">
      <div className="absolute -right-20 top-10 h-72 w-72 rounded-full bg-fuchsia-500/10 blur-3xl"/>
      <div className="absolute -left-20 bottom-0 h-72 w-72 rounded-full bg-cyan-500/10 blur-3xl"/>
      <div className="mx-auto max-w-7xl px-4 pb-12 pt-24 md:px-8">
        <div className="flex justify-between text-[9px] uppercase tracking-[.28em] text-white/40"><span>EVARA·LUX / ARCANA ARENA</span><Link to="/membership" className="hover:text-white">Membership ↗</Link></div>
        <div className="mt-12 grid items-center gap-10 lg:grid-cols-[1.2fr_.8fr]">
          <div>
            <p className="flex items-center gap-2 text-[10px] uppercase tracking-[.25em] text-[#e8c576]"><Flame className="h-3.5 w-3.5"/> Your awakening begins here</p>
            <h1 className="mt-4 font-display text-5xl leading-[.88] tracking-[-.055em] md:text-8xl">ENTER THE<br/><i>ASCENSION ARC.</i></h1>
            <p className="mt-6 max-w-xl text-sm leading-7 text-white/50">An original anime/manhwa-inspired mobile arena. Build an identity, trigger power-ups, climb ranks and turn every run into a cinematic progression loop.</p>
            {!profile && <div className="mt-8 border border-white/10 bg-white/[.035] p-5">
              <p className="text-[9px] uppercase tracking-[.2em] text-[#e8c576]">Create your hunter</p>
              <div className="mt-4 grid gap-3 sm:grid-cols-[1fr_1fr_auto]">
                <input value={codename} onChange={e=>setCodename(e.target.value)} placeholder="Codename" className="border border-white/10 bg-black/30 px-4 py-3 text-sm outline-none focus:border-[#e8c576]/60"/>
                <select value={arch} onChange={e=>setArch(e.target.value)} className="border border-white/10 bg-black/30 px-4 py-3 text-sm outline-none">{archetypes.map(a=><option key={a[0]} value={a[0]}>{a[1]}</option>)}</select>
                <button onClick={()=>void begin()} className="bg-white px-5 py-3 text-[9px] font-semibold uppercase tracking-[.18em] text-black">Awaken</button>
              </div>
            </div>}
          </div>
          <div className="relative mx-auto aspect-square w-full max-w-sm">
            <div className="arcana-spin absolute inset-8 rounded-full border border-dashed border-[#e8c576]/20"/>
            <div className="absolute inset-14 rounded-full border border-white/10"/>
            <div className="arcana-float absolute inset-20 grid place-items-center rounded-[2.5rem] border border-[#e8c576]/30 bg-gradient-to-br from-white/10 to-transparent">
              <div className="text-center"><div className="text-[10px] uppercase tracking-[.3em] text-white/40">{profile?.rank??"E"} Rank</div><div className="mt-2 font-display text-6xl">{profile?.power??100}</div><div className="text-[9px] uppercase tracking-[.22em] text-[#e8c576]">Combat Power</div></div>
            </div>
          </div>
        </div>
      </div>
    </div>

    {profile && <main className="mx-auto max-w-7xl px-4 py-8 md:px-8">
      <section className="grid gap-3 md:grid-cols-4">
        <div className="border border-white/10 bg-white/[.025] p-5 md:col-span-2"><p className="text-[9px] uppercase tracking-[.2em] text-white/40">Codename</p><p className="mt-2 font-display text-3xl">{profile.codename}</p><p className="mt-1 text-xs uppercase text-white/30">{profile.archetype} · {tier.replace("_"," ")}</p></div>
        <div className="border border-white/10 bg-white/[.025] p-5"><p className="text-[9px] uppercase tracking-[.2em] text-white/40">Level</p><p className="mt-2 font-display text-3xl">{profile.level}</p><div className="mt-3 h-1 bg-white/10"><div className="h-full bg-[#e8c576]" style={{width:((profile.xp%1000)/10)+"%"}}/></div></div>
        <div className="border border-white/10 bg-white/[.025] p-5"><p className="text-[9px] uppercase tracking-[.2em] text-white/40">XP</p><p className="mt-2 font-display text-3xl">{profile.xp.toLocaleString()}</p><p className="mt-1 text-xs text-white/30">Rank {profile.rank}</p></div>
      </section>

      <section className="mt-8 grid gap-5 lg:grid-cols-[1.25fr_.75fr]">
        <div className="border border-white/10 bg-[#09090b] p-5 md:p-7">
          <div className="flex items-end justify-between"><div><p className="text-[9px] uppercase tracking-[.22em] text-[#e8c576]">Game modes</p><h2 className="mt-2 font-display text-3xl">Choose your arc.</h2></div><p className="font-display text-2xl">{data?.daily?.energy??0}<span className="text-white/30">/{data?.daily?.maxEnergy??5}</span></p></div>
          <div className="mt-5 grid gap-2 sm:grid-cols-2">{modes.map(m=>{const I=m.icon;return <button key={m.id} onClick={()=>setMode(m.id)} className={"border p-4 text-left transition "+(mode===m.id?"border-[#e8c576]/60 bg-[#e8c576]/5":"border-white/10 bg-white/[.02] hover:border-white/25")}><I className="h-5 w-5 text-[#e8c576]"/><p className="mt-4 text-sm">{m.name}</p><p className="mt-1 text-xs leading-5 text-white/40">{m.desc}</p></button>})}</div>
          <div className="mt-5 border border-white/10 bg-black/30 p-5">
            <div className="flex justify-between"><div><p className="text-[9px] uppercase tracking-[.18em] text-white/40">Live run</p><p className="mt-1 font-display text-3xl">{running?score.toLocaleString():"Ready"}</p></div><div className="text-right"><p className="text-[9px] uppercase tracking-[.18em] text-white/40">Chain</p><p className="mt-1 font-display text-3xl text-[#e8c576]">x{combo}</p></div></div>
            <button disabled={!running} onClick={()=>void strike()} className={"mt-5 h-44 w-full border border-[#e8c576]/30 bg-gradient-to-br from-[#e8c576]/10 via-transparent to-fuchsia-500/5 disabled:opacity-30 "+(pulse?"scale-[.99]":"")}><Zap className="mx-auto h-9 w-9 text-[#e8c576]"/><p className="mt-3 text-[10px] uppercase tracking-[.25em]">{running?"TAP / STRIKE":"Begin an arc below"}</p><p className="mt-2 text-xs text-white/30">Optimized for thumb play</p></button>
            <div className="mt-3 grid grid-cols-2 gap-2"><button onClick={()=>void begin()} className="border border-white/10 py-3 text-[9px] uppercase tracking-[.18em] hover:border-[#e8c576]/50">{running?"Restart":"Begin Arc"}</button><button onClick={()=>void finish()} disabled={!running} className="bg-white py-3 text-[9px] uppercase tracking-[.18em] text-black disabled:opacity-30">End Run</button></div>
          </div>
        </div>
        <div className="space-y-5">
          <div className="border border-white/10 bg-white/[.025] p-6"><div className="flex items-center justify-between"><div><p className="text-[9px] uppercase tracking-[.2em] text-[#e8c576]">Daily ignition</p><h2 className="mt-2 font-display text-2xl">Reset the core.</h2></div><Flame className="h-5 w-5 text-[#e8c576]"/></div><p className="mt-4 text-xs leading-6 text-white/45">Claim your daily spark, restore energy and keep the streak alive.</p><button onClick={()=>void claim()} className="mt-5 w-full border border-[#e8c576]/40 py-3 text-[9px] uppercase tracking-[.18em]">Claim +100 XP</button><p className="mt-3 text-[9px] uppercase tracking-[.16em] text-white/30">Streak {data?.daily?.streak??0}</p></div>
          <div className="border border-white/10 bg-white/[.025] p-6"><div className="flex items-center gap-2"><Gem className="h-4 w-4 text-[#e8c576]"/><p className="text-[9px] uppercase tracking-[.2em] text-[#e8c576]">Power-up vault</p></div><div className="mt-4 space-y-2">{(data?.powerups??[]).map((p:any)=><button key={p.key} onClick={()=>void equip({key:p.key})} className={"flex w-full items-center justify-between border p-3 text-left "+(p.equipped?"border-[#e8c576]/50 bg-[#e8c576]/5":"border-white/10")}><div><p className="text-xs">{powerNames[p.key]??p.name}</p><p className="mt-1 text-[8px] uppercase tracking-[.15em] text-white/30">{p.rarity} · Lv.{p.level}</p></div>{p.equipped?<Sparkles className="h-4 w-4 text-[#e8c576]"/>:<span className="text-[8px] uppercase text-white/30">Equip</span>}</button>)}</div></div>
        </div>
      </section>

      <section className="mt-5 border border-white/10 bg-white/[.02] p-6 md:p-8">
        <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end"><div><p className="text-[9px] uppercase tracking-[.22em] text-[#e8c576]">Identity forge</p><h2 className="mt-2 font-display text-3xl">Your character. Your signature.</h2><p className="mt-2 max-w-2xl text-xs leading-6 text-white/40">Obsidian gets a curated starter set. Sovereign expands the palette. Sovereign-Gilded unlocks the complete cosmetic forge.</p></div><button onClick={()=>setForge(!forge)} className="border border-[#e8c576]/40 px-5 py-3 text-[9px] uppercase tracking-[.18em]">{forge?"Close Forge":"Open Forge"} · {Object.keys(profile.customization??{}).length}/{limit}</button></div>
        {forge && <div className="mt-7 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">{cosmetics.map((c,i)=>{const locked=i>=limit;return <button key={c[0]} disabled={locked} onClick={()=>void saveCosmetic(c[0])} className={"relative border p-4 text-left "+(locked?"border-white/5 opacity-30":"border-white/10 hover:border-[#e8c576]/50")}>{locked&&<Lock className="absolute right-3 top-3 h-3.5 w-3.5"/>}<p className="text-[9px] uppercase tracking-[.15em] text-white/35">{c[0]}</p><p className="mt-2 text-sm">{c[1]}</p><p className="mt-3 text-[9px] text-[#e8c576]">{locked?"Unlock at Sovereign-Gilded":"Tap to cycle"}</p></button>})}</div>}
      </section>

      <section className="mt-5 grid gap-3 md:grid-cols-3">
        <div className="border border-white/10 p-5"><Trophy className="h-5 w-5 text-[#e8c576]"/><p className="mt-4 text-[9px] uppercase tracking-[.18em] text-white/35">Achievements</p><p className="mt-1 font-display text-2xl">{data?.achievements?.length??0}</p></div>
        <div className="border border-white/10 p-5"><Crown className="h-5 w-5 text-[#e8c576]"/><p className="mt-4 text-[9px] uppercase tracking-[.18em] text-white/35">Rank</p><p className="mt-1 font-display text-2xl">{profile.rank}</p></div>
        <div className="border border-white/10 p-5"><Sparkles className="h-5 w-5 text-[#e8c576]"/><p className="mt-4 text-[9px] uppercase tracking-[.18em] text-white/35">Active power</p><p className="mt-1 font-display text-xl">{equipped?(powerNames[equipped.key]??equipped.name):"None"}</p></div>
      </section>
    </main>}
  </div>
}



