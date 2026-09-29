import { useMemo, useRef, useState } from 'react'
import { Link } from '@tanstack/react-router'
import { useMutation, useQuery } from 'convex/react'
import { ArrowRight, Camera, Check, ChevronRight, Heart, Search, ShoppingBag, Sparkles, Upload, X } from 'lucide-react'
import { api } from '../../../convex/_generated/api'
import type { Id } from '../../../convex/_generated/dataModel'
import { formatMoney } from '@/lib/utils'

const heroImage = 'https://images.unsplash.com/photo-1441986300917-64674bd600d8?auto=format&fit=crop&w=2200&q=85'
const editorialImage = 'https://images.unsplash.com/photo-1525507119028-ed4c629a60a3?auto=format&fit=crop&w=1400&q=85'

export function Storefront() {
  const products = useQuery(api.products.listFeatured, { limit: 10 })
  const categories = useQuery(api.categories.listActive)
  const addItem = useMutation(api.cart.addItem)
  const [query, setQuery] = useState('')
  const [visualOpen, setVisualOpen] = useState(false)
  const [visualName, setVisualName] = useState('')
  const [added, setAdded] = useState<string | null>(null)
  const fileRef = useRef<HTMLInputElement>(null)

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q || !products) return products ?? []
    return products.filter((p) => `${p.name} ${p.shortDescription ?? ''}`.toLowerCase().includes(q))
  }, [products, query])

  async function quickAdd(productId: Id<'products'>) {
    const result = await addItem({ productId, quantity: 1 })
    if (result.ok) {
      setAdded(productId)
      setTimeout(() => setAdded(null), 1800)
    }
  }

  return (
    <div className="min-h-screen bg-background text-foreground">
      <section className="relative min-h-[760px] overflow-hidden">
        <img src={heroImage} alt="" className="absolute inset-0 h-full w-full object-cover opacity-60" />
        <div className="absolute inset-0 bg-gradient-to-b from-background/80 via-background/35 to-background" />
        <div className="relative z-10 mx-auto flex min-h-[760px] max-w-[1440px] flex-col px-5 pb-10 pt-28 md:px-10">
          <div className="flex items-center justify-between border-b border-border/60 pb-4 text-[10px] uppercase tracking-[0.24em] text-muted-foreground">
            <span>EVARA·LUX / THE EDIT</span>
            <span className="hidden md:block">Curated in real time</span>
          </div>

          <div className="flex flex-1 flex-col justify-end pb-12 md:pb-16">
            <p className="mb-5 flex items-center gap-2 text-[11px] uppercase tracking-[0.2em] text-accent">
              <Sparkles className="h-3.5 w-3.5" /> Discover what moves culture
            </p>
            <h1 className="max-w-4xl font-display text-5xl leading-[0.92] tracking-[-0.045em] md:text-8xl">
              Shop the things<br /><i>worth noticing.</i>
            </h1>
            <p className="mt-6 max-w-xl text-sm leading-7 text-muted-foreground md:text-base">
              A living storefront for fashion, beauty, technology and objects with momentum. Search naturally, explore the edit, and move from discovery to checkout without friction.
            </p>

            <div className="relative mt-9 max-w-3xl">
              <div className="flex h-16 items-center gap-3 border border-border bg-background/80 px-5 backdrop-blur-xl">
                <Search className="h-5 w-5 shrink-0 text-muted-foreground" strokeWidth={1.5} />
                <input
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder='Try “minimalist streetwear” or “gifts under $50”'
                  className="min-w-0 flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground"
                />
                <button type="button" onClick={() => setVisualOpen(true)} aria-label="AI visual search" className="flex shrink-0 items-center gap-2 border-l border-border pl-4 text-muted-foreground hover:text-foreground">
                  <Camera className="h-5 w-5" strokeWidth={1.5} />
                  <span className="hidden text-[10px] uppercase tracking-[0.16em] sm:block">Visual</span>
                </button>
              </div>
              {query.trim() && (
                <div className="absolute left-0 right-0 top-[68px] z-30 border border-border bg-card/95 p-3 backdrop-blur-xl">
                  {filtered.length ? filtered.slice(0, 5).map((p) => (
                    <Link key={p._id} to="/product/$slug" params={{ slug: p.slug }} className="flex items-center gap-3 px-3 py-2.5 hover:bg-background">
                      {p.images[0] && <img src={p.images[0]} alt="" className="h-10 w-8 object-cover" />}
                      <span className="line-clamp-1 text-sm">{p.name}</span>
                      <span className="ml-auto text-xs text-muted-foreground">{formatMoney(p.priceMinor, p.currency)}</span>
                    </Link>
                  )) : <p className="px-3 py-3 text-sm text-muted-foreground">No matching featured products yet. Press enter in Shop to search the full catalog.</p>}
                </div>
              )}
            </div>

            <div className="mt-4 flex gap-2 overflow-x-auto pb-1">
              {(categories ?? []).slice(0, 8).map((c) => (
                <Link key={c._id} to="/catalog" search={{ category: c.slug }} className="shrink-0 rounded-full border border-border bg-background/45 px-4 py-2 text-[10px] uppercase tracking-[0.14em] text-muted-foreground transition hover:border-accent hover:text-foreground">
                  {c.name}
                </Link>
              ))}
              <Link to="/catalog" className="shrink-0 rounded-full border border-accent/50 px-4 py-2 text-[10px] uppercase tracking-[0.14em] text-accent">View all</Link>
            </div>
          </div>
        </div>
      </section>

      <section className="border-y border-border bg-card/50">
        <div className="mx-auto grid max-w-[1440px] grid-cols-2 md:grid-cols-4">
          {['Trending now', 'Creator-led discovery', 'Secure checkout', 'Curated weekly'].map((label, i) => (
            <div key={label} className="border-r border-border px-5 py-5 last:border-r-0 md:px-8">
              <p className="text-[10px] uppercase tracking-[0.18em] text-muted-foreground">0{i + 1}</p>
              <p className="mt-2 text-sm">{label}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="mx-auto max-w-[1440px] px-5 py-20 md:px-10 md:py-28">
        <div className="mb-9 flex items-end justify-between gap-5">
          <div>
            <p className="text-[10px] uppercase tracking-[0.2em] text-accent">The live edit</p>
            <h2 className="mt-3 font-display text-4xl tracking-[-0.035em] md:text-6xl">Trending products</h2>
          </div>
          <Link to="/catalog" className="hidden items-center gap-2 text-[10px] uppercase tracking-[0.16em] text-muted-foreground hover:text-foreground sm:flex">Shop all <ArrowRight className="h-3.5 w-3.5" /></Link>
        </div>

        <div className="grid auto-rows-[minmax(300px,auto)] grid-cols-2 gap-3 md:grid-cols-4">
          {(products ?? []).slice(0, 8).map((p, i) => (
            <article key={p._id} className={i === 0 ? 'group relative col-span-2 row-span-2 overflow-hidden bg-card' : i === 3 ? 'group relative col-span-2 overflow-hidden bg-card' : 'group relative overflow-hidden bg-card'}>
              <Link to="/product/$slug" params={{ slug: p.slug }} className="block h-full min-h-[300px]">
                {p.images[0] ? <img src={p.images[0]} alt={p.name} className="absolute inset-0 h-full w-full object-cover transition duration-700 group-hover:scale-[1.035]" /> : <div className="absolute inset-0 bg-card" />}
                <div className="absolute inset-0 bg-gradient-to-t from-background/90 via-transparent to-background/5" />
                <div className="absolute left-4 top-4 flex items-center gap-2">
                  <span className="rounded-full bg-background/80 px-2.5 py-1 text-[9px] uppercase tracking-[0.14em] backdrop-blur">Trending</span>
                  {i === 0 && <span className="rounded-full border border-accent/50 bg-background/70 px-2.5 py-1 text-[9px] uppercase tracking-[0.14em] text-accent backdrop-blur">Featured</span>}
                </div>
                <div className="absolute inset-x-4 bottom-4">
                  <div className="flex items-end justify-between gap-4">
                    <div>
                      <p className="font-display text-xl leading-tight md:text-2xl">{p.name}</p>
                      <p className="mt-1 text-xs text-muted-foreground">{formatMoney(p.priceMinor, p.currency)}</p>
                    </div>
                    <button
                      type="button"
                      onClick={(e) => { e.preventDefault(); e.stopPropagation(); void quickAdd(p._id) }}
                      className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-foreground text-background transition hover:scale-105"
                      aria-label={`Quick add ${p.name}`}
                    >
                      {added === p._id ? <Check className="h-4 w-4" /> : <ShoppingBag className="h-4 w-4" strokeWidth={1.5} />}
                    </button>
                  </div>
                </div>
              </Link>
            </article>
          ))}
          {!products?.length && (
            <div className="col-span-full border border-dashed border-border py-24 text-center text-sm text-muted-foreground">Your product edit will appear here as active featured products are added.</div>
          )}
        </div>
      </section>

      <section className="mx-auto grid max-w-[1440px] gap-3 px-5 pb-20 md:grid-cols-[1.15fr_.85fr] md:px-10 md:pb-28">
        <div className="relative min-h-[560px] overflow-hidden bg-card">
          <img src={editorialImage} alt="EVARA-LUX editorial" className="absolute inset-0 h-full w-full object-cover opacity-75" />
          <div className="absolute inset-0 bg-gradient-to-t from-background via-background/10 to-transparent" />
          <div className="absolute inset-x-7 bottom-7 md:inset-x-10 md:bottom-10">
            <p className="text-[10px] uppercase tracking-[0.2em] text-accent">Editorial / 01</p>
            <h2 className="mt-3 max-w-xl font-display text-4xl leading-none md:text-6xl">Less noise.<br /><i>More signal.</i></h2>
            <p className="mt-5 max-w-md text-sm leading-6 text-muted-foreground">Evara-lux turns product discovery into an editorial experience, with the commerce layer always one step away.</p>
          </div>
        </div>
        <div className="grid gap-3 md:grid-rows-2">
          <div className="flex flex-col justify-between border border-border bg-card p-7 md:p-10">
            <Sparkles className="h-6 w-6 text-accent" strokeWidth={1.2} />
            <div>
              <p className="text-[10px] uppercase tracking-[0.2em] text-muted-foreground">AI discovery</p>
              <h3 className="mt-3 font-display text-3xl">Describe it.<br />We find it.</h3>
              <p className="mt-4 text-sm leading-6 text-muted-foreground">Use natural language to narrow the storefront by style, purpose, budget or intent.</p>
            </div>
          </div>
          <div className="flex flex-col justify-between border border-border bg-card p-7 md:p-10">
            <Heart className="h-6 w-6 text-accent" strokeWidth={1.2} />
            <div>
              <p className="text-[10px] uppercase tracking-[0.2em] text-muted-foreground">Social commerce</p>
              <h3 className="mt-3 font-display text-3xl">Discover from people.</h3>
              <Link to="/dashboard/social" className="mt-5 inline-flex items-center gap-2 text-[10px] uppercase tracking-[0.16em]">Open the social edit <ArrowRight className="h-3.5 w-3.5" /></Link>
            </div>
          </div>
        </div>
      </section>

      <section className="border-y border-border">
        <div className="mx-auto flex max-w-[1440px] flex-col items-start justify-between gap-7 px-5 py-14 md:flex-row md:items-center md:px-10">
          <div><p className="text-[10px] uppercase tracking-[0.2em] text-accent">One tap away</p><h2 className="mt-2 font-display text-3xl">Ready when you are.</h2></div>
          <Link to="/catalog" className="inline-flex items-center gap-3 bg-foreground px-6 py-3 text-[10px] uppercase tracking-[0.18em] text-background hover:opacity-90">Enter the store <ChevronRight className="h-4 w-4" /></Link>
        </div>
      </section>

      {visualOpen && (
        <div className="fixed inset-0 z-[90] grid place-items-center bg-background/80 p-5 backdrop-blur-md">
          <div className="w-full max-w-lg border border-border bg-card p-7 md:p-9">
            <div className="flex items-start justify-between">
              <div><p className="text-[10px] uppercase tracking-[0.2em] text-accent">AI Visual Search</p><h2 className="mt-2 font-display text-3xl">Show us what you mean.</h2></div>
              <button type="button" onClick={() => setVisualOpen(false)} aria-label="Close visual search"><X className="h-5 w-5 text-muted-foreground" /></button>
            </div>
            <button type="button" onClick={() => fileRef.current?.click()} className="mt-8 flex min-h-48 w-full flex-col items-center justify-center border border-dashed border-border bg-background/50 text-center hover:border-accent">
              <Upload className="h-7 w-7 text-accent" strokeWidth={1.2} />
              <span className="mt-4 text-sm">{visualName || 'Upload a reference image'}</span>
              <span className="mt-2 text-xs text-muted-foreground">JPG, PNG or WEBP</span>
            </button>
            <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={(e) => setVisualName(e.target.files?.[0]?.name ?? '')} />
            <p className="mt-4 text-xs leading-5 text-muted-foreground">The storefront interface is ready for image-to-product matching. Connect the visual-search capability to turn this upload into live product matches.</p>
          </div>
        </div>
      )}
    </div>
  )
}
