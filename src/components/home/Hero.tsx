export function Hero() {
  return (
    <section id="top" className="relative flex min-h-screen items-center overflow-hidden bg-background">
      {/* Textural backdrop — swap for real editorial photography once assets are supplied */}
      <div className="pointer-events-none absolute inset-0">
        <div
          className="absolute inset-0 opacity-[0.9]"
          style={{
            background:
              'radial-gradient(120% 90% at 82% 12%, hsl(var(--evara-champagne) / 0.16), transparent 60%), radial-gradient(90% 70% at 10% 100%, hsl(var(--evara-champagne) / 0.08), transparent 55%)',
          }}
        />
        <div
          className="absolute inset-0 opacity-[0.35]"
          style={{
            backgroundImage:
              'linear-gradient(hsl(var(--evara-ivory) / 0.05) 1px, transparent 1px), linear-gradient(90deg, hsl(var(--evara-ivory) / 0.05) 1px, transparent 1px)',
            backgroundSize: '64px 64px',
            maskImage: 'radial-gradient(70% 60% at 60% 40%, black, transparent)',
          }}
        />
      </div>

      <div className="relative mx-auto w-full max-w-[1400px] px-6 pt-24 md:px-10">
        <p className="evara-reveal is-visible font-sans text-[11px] font-medium tracking-[0.3em] text-muted-foreground">
          THE EVARA EXPERIENCE / 01
        </p>

        <h1 className="evara-reveal is-visible mt-6 max-w-4xl font-display text-[clamp(2.75rem,7vw,6rem)] font-medium leading-[0.98] tracking-tight text-foreground [animation-delay:120ms]">
          MORE THAN
          <br />
          WHAT YOU BUY.
        </h1>

        <p className="evara-reveal is-visible mt-8 max-w-md font-sans text-base leading-relaxed text-muted-foreground [animation-delay:260ms]">
          EVARA-LUX is where exceptional products meet the feeling you're looking for.
        </p>

        <div className="evara-reveal is-visible mt-10 flex flex-col gap-4 sm:flex-row sm:items-center [animation-delay:380ms]">
          <a
            href="#featured-collection"
            className="inline-flex items-center justify-center border border-foreground bg-foreground px-8 py-4 text-[12px] font-semibold tracking-[0.18em] text-primary-foreground transition-colors duration-300 hover:bg-transparent hover:text-foreground"
          >
            EXPLORE THE COLLECTION
          </a>
          <a
            href="#editorial"
            className="inline-flex items-center justify-center border border-border px-8 py-4 text-[12px] font-semibold tracking-[0.18em] text-foreground transition-colors duration-300 hover:border-foreground"
          >
            DISCOVER EVARA
          </a>
        </div>
      </div>

      <div className="absolute bottom-10 left-6 hidden items-center gap-3 text-muted-foreground md:flex md:left-10">
        <span className="h-px w-10 bg-border" />
        <span className="text-[11px] tracking-[0.25em]">SCROLL</span>
      </div>
    </section>
  )
}
