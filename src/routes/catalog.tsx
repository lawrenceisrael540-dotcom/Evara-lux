import { createFileRoute, Link } from "@tanstack/react-router"
import { useQuery, useMutation } from "convex/react"
import { api } from "../../convex/_generated/api"
import { formatMoney } from "../lib/utils"
import { ShoppingBag } from "lucide-react"

export const Route = createFileRoute("/catalog")({ component: CatalogPage })

function CatalogPage() {
  const products = useQuery(api.products.listFeatured, { limit: 50 })
  const categories = useQuery(api.categories.listActive)
  const addItem = useMutation(api.cart.addItem)
  return <section className="mx-auto max-w-[1440px] px-5 py-12 md:px-10">
    <div className="border-b border-border pb-8">
      <p className="text-[10px] uppercase tracking-[.22em] text-accent">EVARA·LUX / SHOP</p>
      <h1 className="mt-2 font-display text-5xl">The Catalog.</h1>
      <p className="mt-3 max-w-2xl text-sm text-muted-foreground">Live products from the commerce backend. Availability and pricing are read from Convex.</p>
    </div>
    <div className="mt-6 flex gap-2 overflow-x-auto pb-2">
      {(categories ?? []).map(c => <Link key={c._id} to="/catalog" search={{ category: c.slug }} className="shrink-0 rounded-full border border-border px-4 py-2 text-[10px] uppercase tracking-[.14em] hover:border-accent">{c.name}</Link>)}
    </div>
    <div className="mt-8 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
      {(products ?? []).map(p => <article key={p._id} className="group border border-border bg-card">
        <Link to="/product/$slug" params={{ slug: p.slug }} className="block">
          <div className="aspect-[4/5] bg-muted">{p.images[0] && <img src={p.images[0]} alt={p.name} className="h-full w-full object-cover transition group-hover:scale-[1.02]" />}</div>
          <div className="p-4"><h2 className="font-display text-xl">{p.name}</h2><p className="mt-1 text-xs text-muted-foreground">{formatMoney(p.priceMinor,p.currency)}</p></div>
        </Link>
        <button onClick={() => void addItem({ productId:p._id, quantity:1 })} className="m-4 inline-flex items-center gap-2 border border-border px-4 py-2 text-[10px] uppercase tracking-[.14em] hover:border-accent"><ShoppingBag className="h-3.5 w-3.5"/> Add</button>
      </article>)}
    </div>
  </section>
}
