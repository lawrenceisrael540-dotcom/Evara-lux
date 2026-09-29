import { useState } from "react"
import { useMutation, useQuery } from "convex/react"
import { Link } from "@tanstack/react-router"
import { Check, EyeOff, LockKeyhole, Shield, Users } from "lucide-react"
import { api } from "../../../convex/_generated/api"

const metricLabels = [
  ["showFollowers", "Followers", "Let visitors see your follower count."],
  ["showFollowing", "Following", "Let visitors see who you follow."],
  ["showLikes", "Likes", "Show total likes across your posts."],
  ["showComments", "Comments", "Show your public comment activity."],
  ["showReshares", "Reshares / Quotes", "Show reshare activity on your posts."],
  ["showViews", "Views", "Show exact post view counts."],
] as const

/**
 * The "Ghost Shield" privacy controls — extracted from the standalone /privacy
 * route so it can also render inline as Membership & Tiers' Privacy Center
 * tab without duplicating the settings logic in two places. /privacy still
 * works on its own; it just renders this component now.
 */
export function PrivacyCenter() {
  const settings = useQuery(api.privacy.getMyPrivacy)
  const metrics = useQuery(api.privacy.getMyMetrics)
  const update = useMutation(api.privacy.updateMyPrivacy)
  const [saved, setSaved] = useState(false)

  if (!settings) return <p className="text-sm text-muted-foreground">Loading…</p>

  const patch = async (key: keyof typeof settings, value: boolean | "public" | "contact_only" | "private") => {
    const next = { ...settings, [key]: value }
    await update(next)
    setSaved(true)
    window.setTimeout(() => setSaved(false), 1800)
  }

  return (
    <div>
      <div className="max-w-3xl">
        <p className="text-[10px] uppercase tracking-[0.24em] text-accent">Ghost Shield</p>
        <h2 className="mt-2 font-display text-3xl tracking-[-0.03em]">Your audience. Your metrics. Your rules.</h2>
        <p className="mt-3 text-sm leading-7 text-muted-foreground">Control who can reach your profile, which engagement numbers are public, and whether your posts can be selectively hidden from specific accounts.</p>
      </div>

      <section className="mt-8 grid gap-5 lg:grid-cols-[1.1fr_.9fr]">
        <div className="border border-border bg-card p-6 md:p-8">
          <div className="flex items-center gap-3"><Shield className="h-5 w-5 text-accent" /><div><p className="text-[10px] uppercase tracking-[0.2em] text-accent">Profile access</p><h3 className="mt-1 font-display text-xl">Ghost Shield mode</h3></div></div>
          <div className="mt-6 grid gap-2">
            {([
              ["public", "Public", "Anyone can view your published social profile."],
              ["contact_only", "Contact-only", "Outsiders see only your verified contact card; posts, media and metrics stay hidden."],
              ["private", "Private", "Only you and approved connections can access the profile surface."],
            ] as const).map(([id, title, desc]) => (
              <button key={id} onClick={() => void patch("profileMode", id)} className={`border p-4 text-left transition ${settings.profileMode === id ? "border-accent bg-accent/5" : "border-border hover:border-accent/50"}`}>
                <div className="flex items-center justify-between"><span className="text-sm">{title}</span>{settings.profileMode === id && <Check className="h-4 w-4 text-accent" />}</div>
                <p className="mt-2 text-xs leading-5 text-muted-foreground">{desc}</p>
              </button>
            ))}
          </div>
        </div>

        <div className="border border-border bg-card p-6 md:p-8">
          <p className="text-[10px] uppercase tracking-[0.2em] text-accent">Your current totals</p>
          <div className="mt-5 grid grid-cols-2 gap-px border border-border bg-border">
            {Object.entries(metrics ?? {}).map(([key, value]) => <div key={key} className="bg-card p-4"><p className="text-[9px] uppercase tracking-[0.14em] text-muted-foreground">{key}</p><p className="mt-2 font-display text-2xl">{Number(value).toLocaleString()}</p></div>)}
          </div>
          <p className="mt-4 text-[11px] leading-5 text-muted-foreground">These are account-owned metrics. Visibility below controls what other people may see; private metrics never become public simply because a post performs well.</p>
        </div>
      </section>

      <section className="mt-5 border border-border bg-card p-6 md:p-8">
        <div className="flex items-center gap-3"><EyeOff className="h-5 w-5 text-accent" /><div><p className="text-[10px] uppercase tracking-[0.2em] text-accent">Granular metrics</p><h3 className="mt-1 font-display text-xl">Show only what you want.</h3></div></div>
        <div className="mt-6 grid gap-3 md:grid-cols-2">
          {metricLabels.map(([key, title, desc]) => (
            <button key={key} onClick={() => void patch(key, !settings[key])} className="flex items-start justify-between gap-4 border border-border p-4 text-left hover:border-accent/60">
              <div><p className="text-sm">{title}</p><p className="mt-1 text-xs leading-5 text-muted-foreground">{desc}</p></div>
              <span className={`mt-1 h-5 w-9 rounded-full border p-0.5 ${settings[key] ? "border-accent" : "border-border"}`}><span className={`block h-3.5 w-3.5 rounded-full transition ${settings[key] ? "translate-x-4 bg-accent" : "bg-muted-foreground"}`} /></span>
            </button>
          ))}
        </div>
        <label className="mt-3 flex items-center justify-between gap-5 border border-border p-4">
          <div><p className="text-sm">Private Metrics mode</p><p className="mt-1 text-xs leading-5 text-muted-foreground">Keep exact engagement totals owner-only. Public surfaces can use qualitative labels instead of counts.</p></div>
          <input type="checkbox" checked={settings.privateMetrics} onChange={e => void patch("privateMetrics", e.target.checked)} className="h-4 w-4 accent-[hsl(var(--accent))]" />
        </label>
        <label className="mt-3 flex items-center justify-between gap-5 border border-border p-4">
          <div><p className="text-sm">Negative comment shield</p><p className="mt-1 text-xs leading-5 text-muted-foreground">Flag abusive or hostile language for moderation instead of immediately exposing it.</p></div>
          <input type="checkbox" checked={settings.hideNegativeComments} onChange={e => void patch("hideNegativeComments", e.target.checked)} className="h-4 w-4 accent-[hsl(var(--accent))]" />
        </label>
      </section>

      <section className="mt-5 grid gap-5 md:grid-cols-2">
        <div className="border border-border bg-card p-6">
          <Users className="h-5 w-5 text-accent" />
          <h3 className="mt-4 font-display text-xl">Trusted accounts</h3>
          <p className="mt-2 text-sm leading-6 text-muted-foreground">The backend now supports a creator-owned trusted list for direct engagement and moderation exceptions.</p>
          <p className="mt-4 text-[10px] uppercase tracking-[0.15em] text-accent">Manage from your social controls</p>
        </div>
        <div className="border border-border bg-card p-6">
          <LockKeyhole className="h-5 w-5 text-accent" />
          <h3 className="mt-4 font-display text-xl">Hide From…</h3>
          <p className="mt-2 text-sm leading-6 text-muted-foreground">Post publishing now supports account and connection-based exclusions at the data layer, so future composer controls can block a targeted audience without making the whole profile private.</p>
          <Link to="/social" className="mt-4 inline-block text-[10px] uppercase tracking-[0.15em]">Return to Social Edit →</Link>
        </div>
      </section>

      {saved && <div className="fixed bottom-5 left-1/2 z-50 -translate-x-1/2 border border-border bg-card px-5 py-3 text-xs shadow-2xl">Privacy settings saved.</div>}
    </div>
  )
}
