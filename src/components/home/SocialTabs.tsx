import { Link } from "@tanstack/react-router"

// "Stories" is intentionally not a tab here: schema.ts has stories/storyViews
// tables, but there is no convex/stories.ts and no stories UI anywhere in the
// app yet. Adding a tab for it would just be another dead link — the same
// problem the Storefront hub's old Wishlist/Orders tabs had — so it's left
// out until there's a real destination to send it to.
const TABS: Array<{ to: "/dashboard/social" | "/friends" | "/arena" | "/messages"; label: string }> = [
  { to: "/dashboard/social", label: "Home" },
  { to: "/friends", label: "Friends" },
  { to: "/arena", label: "Games" },
  { to: "/messages", label: "Messages" },
]

/** Shared Social Studio tab bar — mirrors ShopTabs for the storefront hub. */
export function SocialTabs({ active }: { active: (typeof TABS)[number]["to"] }) {
  return (
    <nav aria-label="Social Studio" className="mt-6 -mx-1 overflow-x-auto pb-1">
      <div className="flex min-w-max items-center gap-1 border border-border bg-card/60 p-1">
        {TABS.map((tab) => (
          <Link
            key={tab.label}
            to={tab.to}
            className={`px-4 py-2.5 text-[10px] uppercase tracking-[0.14em] transition-colors ${
              tab.to === active ? "bg-foreground text-background" : "text-muted-foreground hover:bg-background hover:text-foreground"
            }`}
          >
            {tab.label}
          </Link>
        ))}
      </div>
    </nav>
  )
}
