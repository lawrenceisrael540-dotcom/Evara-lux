import { useQuery } from "convex/react"
import { Link } from "@tanstack/react-router"
import { Gem, LinkIcon, Sparkles } from "lucide-react"
import { api } from "../../../convex/_generated/api"

/**
 * A read-only preview of the Sovereign "atelier" showcase — pinned media,
 * link-in-bio, bio style and status tag. The actual editing form is
 * SovereignConsole on /membership (Console tab); duplicating a second write
 * form here would just be two places that can drift, so this tab links out
 * to edit and focuses on showing what's live.
 */
export function ShowcasePanel() {
  const features = useQuery(api.membership.getSovereignFeatures)
  const profile = useQuery(api.membership.getMySovereignProfile)

  if (!features) return <p className="text-sm text-muted-foreground">Loading…</p>

  if (!features.isSovereign) {
    return (
      <div className="border border-border bg-card p-8 text-center">
        <Gem className="mx-auto h-5 w-5 text-accent" />
        <h2 className="mt-4 font-display text-2xl">Showcase unlocks at Sovereign.</h2>
        <p className="mx-auto mt-2 max-w-[42ch] text-sm leading-relaxed text-muted-foreground">
          Pinned media slots, link-in-bio and custom bio styling are part of the Sovereign layer and above.
        </p>
        <Link to="/membership" className="mt-5 inline-block border border-accent px-5 py-3 text-[10px] uppercase tracking-[0.15em] text-accent">View membership tiers</Link>
      </div>
    )
  }

  return (
    <div>
      <div className="flex items-center justify-between gap-4">
        <div>
          <p className="text-[10px] uppercase tracking-[0.2em] text-accent">Showcase</p>
          <h2 className="mt-2 font-display text-3xl tracking-[-0.03em]">Your pinned identity.</h2>
        </div>
        <Link to="/membership" className="whitespace-nowrap border border-border px-4 py-2.5 text-[10px] uppercase tracking-[0.14em] hover:border-accent">Edit in Console →</Link>
      </div>

      <div className="mt-7 grid gap-3 sm:grid-cols-3">
        {(profile?.pinnedMediaUrls ?? []).map((url, i) => (
          <div key={i} className="aspect-square overflow-hidden border border-border bg-card">
            <img src={url} alt="" className="h-full w-full object-cover" />
          </div>
        ))}
        {(!profile || profile.pinnedMediaUrls.length === 0) && (
          <div className="col-span-full border border-border p-8 text-center text-sm text-muted-foreground">
            No pinned media yet — add up to {features.maxPinnedMedia} pieces from the Membership Console.
          </div>
        )}
      </div>

      <div className="mt-5 grid gap-3 md:grid-cols-3">
        <div className="border border-border bg-card p-5">
          <Sparkles className="h-4 w-4 text-accent" />
          <p className="mt-3 text-[9px] uppercase tracking-[0.14em] text-muted-foreground">Bio style</p>
          <p className="mt-1 text-sm capitalize">{profile?.customBioStyle ?? "Not set"}</p>
        </div>
        <div className="border border-border bg-card p-5">
          <LinkIcon className="h-4 w-4 text-accent" />
          <p className="mt-3 text-[9px] uppercase tracking-[0.14em] text-muted-foreground">Link in bio</p>
          <p className="mt-1 truncate text-sm">{profile?.linkInBioLabel || "Not set"}</p>
        </div>
        <div className="border border-border bg-card p-5">
          <Gem className="h-4 w-4 text-accent" />
          <p className="mt-3 text-[9px] uppercase tracking-[0.14em] text-muted-foreground">Status tag</p>
          <p className="mt-1 text-sm">{profile?.statusTag || "Not set"}</p>
        </div>
      </div>
    </div>
  )
}
