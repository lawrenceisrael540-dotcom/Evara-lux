import { useReveal } from '@/hooks/use-reveal'

export function Editorial() {
  const { ref, visible } = useReveal<HTMLDivElement>()

  return (
    <section id="editorial" className="border-t border-border bg-background">
      <div className="grid grid-cols-1 md:grid-cols-2">
        {/* Real editorial photography slot — replace once brand imagery is supplied */}
        <div className="relative min-h-[360px] overflow-hidden border-b border-border md:min-h-[560px] md:border-b-0 md:border-r">
          <div
            className="absolute inset-0"
            style={{
              background:
                'linear-gradient(155deg, hsl(var(--evara-surface)) 0%, hsl(var(--evara-ink)) 55%, hsl(var(--evara-champagne) / 0.10) 100%)',
            }}
          />
          <div
            className="absolute inset-0 opacity-[0.15]"
            style={{
              backgroundImage: 'linear-gradient(90deg, hsl(var(--evara-ivory) / 0.4) 1px, transparent 1px)',
              backgroundSize: '3px 100%',
            }}
          />
        </div>

        <div
          ref={ref}
          className={`evara-reveal flex flex-col justify-center px-6 py-20 md:px-16 ${visible ? 'is-visible' : ''}`}
        >
          <span className="font-sans text-[11px] tracking-[0.3em] text-muted-foreground">THE EVARA JOURNAL</span>
          <h2 className="mt-6 max-w-md font-display text-3xl tracking-tight text-foreground md:text-4xl">
            THE ART OF ARRIVING.
          </h2>
          <p className="mt-6 max-w-md text-sm leading-relaxed text-muted-foreground md:text-base">
            Every EVARA piece is chosen with intention — not for what it says about a trend, but for how it settles
            into your life. This is the space where we write about that intention: the makers, the materials, and the
            moments a considered object can quietly change.
          </p>
          <a
            href="#top"
            className="mt-8 inline-flex w-fit items-center gap-3 border-b border-foreground/40 pb-1 text-[12px] font-semibold tracking-[0.18em] text-foreground transition-colors duration-300 hover:border-foreground"
          >
            READ THE STORY
          </a>
        </div>
      </div>
    </section>
  )
}
