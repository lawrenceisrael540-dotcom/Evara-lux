import { createFileRoute, Link } from "@tanstack/react-router"
import { useMutation, useQuery } from "convex/react"
import { api } from "../../convex/_generated/api"
import { formatMoney } from "../lib/utils"

export const Route = createFileRoute("/product/$slug")({ component: ProductPage })

function ProductPage() {
  const { slug } = Route.useParams()
  const product = useQuery(api.products.getBySlug, { slug })
  const addItem = useMutation(api.cart.addItem)
  if (product === undefined) return <div className="p-12 text-sm text-muted-foreground">Loading product…</div>
  if (!product) return <div className="mx-auto max-w-4xl p-12"><p className="text-sm">Product not found.</p><Link to="/catalog" className="mt-4 inline-block underline">Back to catalog</Link></div>
  return <section className="mx-auto grid max-w-[1200px] gap-8 px-5 py-12 md:grid-cols-2 md:px-10">
    <div className="aspect-square overflow-hidden bg-card">{product.images[0] && <img src={product.images[0]} alt={product.name} className="h-full w-full object-cover" />}</div>
    <div className="self-center">
      <p className="text-[10px] uppercase tracking-[.22em] text-accent">EVARA·LUX / OBJECT</p>
      <h1 className="mt-3 font-display text-5xl">{product.name}</h1>
      <p className="mt-4 text-lg">{formatMoney(product.priceMinor,product.currency)}</p>
      <p className="mt-5 text-sm leading-7 text-muted-foreground">{product.description ?? product.shortDescription ?? "A curated EVARA-LUX object."}</p>
      <p className="mt-5 text-xs uppercase tracking-[.12em] text-muted-foreground">{product.inventoryStatus.replaceAll("_"," ")}</p>
      <button onClick={() => void addItem({productId:product._id,quantity:1})} className="mt-7 bg-foreground px-6 py-4 text-[10px] uppercase tracking-[.16em] text-background">Add to cart</button>
    </div>
  </section>
}
