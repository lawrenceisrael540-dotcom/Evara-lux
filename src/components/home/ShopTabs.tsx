import { Link } from "@tanstack/react-router"

const TABS: Array<{ to: "/dashboard/shop" | "/catalog" | "/brands" | "/dashboard/shop/wishlist" | "/checkout" | "/dashboard/shop/orders"; label: string }> = [
  { to: "/dashboard/shop", label: "Home" },
  { to: "/catalog", label: "Discover" },
  { to: "/brands", label: "Brands" },
  { to: "/dashboard/shop/wishlist", label: "Wishlist" },
  { to: "/checkout", label: "Cart" },
  { to: "/dashboard/shop/orders", label: "Orders" },
]

/**
 * Shared Storefront tab bar. A single source of truth for the six Storefront
 * destinations so the tabs stay identical (and correctly wired) across
 * /dashboard/shop, /dashboard/shop/wishlist and /dashboard/shop/orders,
 * instead of each page keeping its own copy of the list.
 */
export function ShopTabs({ active }: { active: (typeof TABS)[number]["to"] }) {
  return (
    <nav aria-label="Storefront" className="mt-6 -mx-1 overflow-x-auto pb-1">
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
