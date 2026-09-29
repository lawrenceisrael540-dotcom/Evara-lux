import { useState } from "react"
import { useMutation, useQuery } from "convex/react"
import { Link } from "@tanstack/react-router"
import { BarChart3, Gem, ShieldCheck, Trophy, Wand2 } from "lucide-react"
import { api } from "../../../convex/_generated/api"

export function SovereignConsole() {
  const features = useQuery(api.membership.getSovereignFeatures)
  const profile = useQuery(api.membership.getMySovereignProfile)
  const save = useMutation(api.membership.upsertSovereignProfile)
  const [style, setStyle] = useState<"classic"|"editorial"|"steel"|"minimal">(profile?.customBioStyle ?? "classic")
  const [tag, setTag] = useState(profile?.statusTag ?? "")
  const [label, setLabel] = useState(profile?.linkInBioLabel ?? "")
  const [url, setUrl] = useState(profile?.linkInBioUrl ?? "")
  const [pinned, setPinned] = useState(profile?.pinnedMediaUrls?.join(", ") ?? "")
  const [saved, setSaved] = useState(false)

  if (!features?.isSovereign) return null

  async function submit() {
    const ok = await save({
      customBioStyle: style,
      pinnedMediaUrls: pinned.split(",").map(x => x.trim()).filter(Boolean),
      linkInBioLabel: label.trim() || undefined,
      linkInBioUrl: url.trim() || undefined,
      statusTag: tag.trim() || undefined,
      discoveryBoostEnabled: true,
    })
    setSaved(ok)
    window.setTimeout(() => setSaved(false), 2200)
  }

  return <section className="mt-5 overflow-hidden border border-slate-400/35 bg-gradient-to-br from-slate-500/10 via-background to-accent/5 p-6 shadow-lg shadow-black/40 md:p-8">
    <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
      <div>
        <p className="text-[10px] uppercase tracking-[0.28em] text-slate-300">EVARA·LUX / SOVEREIGN</p>
        <h2 className="mt-2 font-display text-3xl tracking-[-0.03em]">The Established layer.</h2>
        <p className="mt-2 max-w-2xl text-xs leading-6 text-muted-foreground">Steel identity, expanded privacy, podium-aware Nexa recognition and a deeper member profile—protected by Convex server-side gates.</p>
      </div>
      <div className="flex items-center gap-2 border border-slate-400/30 px-4 py-2 text-[9px] uppercase tracking-[0.14em]"><ShieldCheck className="h-4 w-4 text-slate-300"/> Sovereign verified</div>
    </div>

    <div className="mt-7 grid gap-3 md:grid-cols-4">
      {[
        ["Hide From", String(features.hideFromLimit) + " active", ShieldCheck],
        ["Podium", String(features.pointsPlacementMultiplier) + "×", Trophy],
        ["Pinned", String(features.maxPinnedMedia) + " slots", Gem],
        ["Discovery", "Priority-ready", BarChart3],
      ].map(([labelText, value, Icon]: any) => <div key={labelText} className="border border-slate-400/20 bg-black/10 p-4">
        <Icon className="h-4 w-4 text-slate-300"/><p className="mt-3 text-[9px] uppercase tracking-[0.14em] text-muted-foreground">{labelText}</p><p className="mt-1 text-sm">{value}</p>
      </div>)}
    </div>

    <div className="mt-7 border-t border-slate-400/20 pt-6">
      <div className="flex items-center gap-2"><Wand2 className="h-4 w-4 text-slate-300"/><p className="text-[10px] uppercase tracking-[0.18em] text-slate-300">Member-card atelier</p></div>
      <div className="mt-4 grid gap-3 md:grid-cols-2">
        <select value={style} onChange={e => setStyle(e.target.value as any)} className="border border-border bg-background px-3 py-3 text-xs">
          <option value="classic">Classic typography</option><option value="editorial">Editorial typography</option><option value="steel">Steel signature</option><option value="minimal">Minimal</option>
        </select>
        <input value={tag} onChange={e => setTag(e.target.value)} placeholder="Custom status tag" className="border border-border bg-background px-3 py-3 text-xs"/>
        <input value={label} onChange={e => setLabel(e.target.value)} placeholder="Link-in-bio label" className="border border-border bg-background px-3 py-3 text-xs"/>
        <input value={url} onChange={e => setUrl(e.target.value)} placeholder="https://your-link.example" className="border border-border bg-background px-3 py-3 text-xs"/>
        <input value={pinned} onChange={e => setPinned(e.target.value)} placeholder="Pinned media URLs, comma-separated · max 6" className="border border-border bg-background px-3 py-3 text-xs md:col-span-2"/>
      </div>
      <div className="mt-4 flex flex-wrap items-center gap-4">
        <button onClick={() => void submit()} className="border border-slate-300/50 px-5 py-3 text-[9px] uppercase tracking-[0.15em] hover:border-slate-200">{saved ? "Sovereign identity saved" : "Save Sovereign identity"}</button>
        <Link to="/privacy" className="text-[9px] uppercase tracking-[0.15em] text-muted-foreground hover:text-slate-200">Open Ghost Shield →</Link>
      </div>
    </div>
  </section>
}
