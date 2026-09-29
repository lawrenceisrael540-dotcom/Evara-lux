import { useReveal } from '@/hooks/use-reveal'

/**
 * Intentionally not connected to any backend yet (Convex or Supabase).
 * Once the verified Supabase access pattern for `evara_products_public` /
 * `evara_product_variants_public` is established, replace the empty state
 * below with the real product grid, keeping this same shell/heading.
 */
export function FeaturedCollection() {
  const { ref, visible } = useReveal<HTMLDivElement>()

  return (
    <section id="featured-collection" className="border-t border-border bg-background py-28">
      <div className="mx-auto max-w-[1400px] px-6 md:px-10">
        <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
          <div>
            <h2 className="font-display text-3xl tracking-tight text-foreground md:text-4xl">CURATED FOR YOU.</h2>
            <p className="mt-4 max-w-lg text-sm leading-relaxed text-muted-foreground md:text-base">
              A considered selection of pieces chosen to elevate the way you live, move and express yourself.
            </p>
          </div>
        </div>

        <div
          ref={ref}
          className={`evara-reveal mt-16 flex min-h-[340px] flex-col items-center justify-center border border-dashed border-border px-6 text-center ${visible ? 'is-visible' : ''}`}
        >
          <span className="font-sans text-[11px] tracking-[0.3em] text-muted-foreground">EVARA-LUX</span>
          <p className="mt-5 max-w-md font-display text-2xl text-foreground md:text-3xl">
            THE COLLECTION IS ARRIVING.
          </p>
          <p className="mt-4 max-w-sm text-sm leading-relaxed text-muted-foreground">
            Our first curation is being prepared. Join the list below and be the first to discover it.
          </p>
        </div>
      </div>
    </section>
  )
}
