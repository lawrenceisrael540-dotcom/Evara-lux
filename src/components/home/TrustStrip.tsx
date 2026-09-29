const POINTS = ['SECURE CHECKOUT', 'CURATED PRODUCTS', 'GLOBAL DISCOVERY', 'PERSONALIZED EXPERIENCE']

export function TrustStrip() {
  return (
    <section className="border-t border-border bg-background">
      <div className="mx-auto grid max-w-[1400px] grid-cols-2 divide-x divide-y divide-border border-b border-border px-6 sm:grid-cols-4 sm:divide-y-0 md:px-10">
        {POINTS.map((point) => (
          <div key={point} className="flex items-center justify-center px-4 py-8 text-center">
            <span className="text-[11px] font-medium tracking-[0.2em] text-muted-foreground">{point}</span>
          </div>
        ))}
      </div>
    </section>
  )
}
