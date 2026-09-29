import { useReveal } from '@/hooks/use-reveal'

const CONCEPTS = [
  { title: 'UNDERSTANDS', line: 'Your preferences.' },
  { title: 'DISCOVERS', line: 'Products that fit your world.' },
  { title: 'REMEMBERS', line: 'An experience that becomes more personal over time.' },
]

export function Intelligence() {
  const { ref, visible } = useReveal<HTMLDivElement>()

  return (
    <section id="intelligence" className="relative overflow-hidden border-t border-border bg-background py-28">
      <div
        className="pointer-events-none absolute inset-0 opacity-60"
        style={{
          background: 'radial-gradient(60% 60% at 50% 0%, hsl(var(--evara-champagne) / 0.10), transparent 70%)',
        }}
      />
      <div ref={ref} className={`evara-reveal relative mx-auto max-w-[1400px] px-6 md:px-10 ${visible ? 'is-visible' : ''}`}>
        <div className="mx-auto max-w-2xl text-center">
          <h2 className="font-display text-3xl tracking-tight text-foreground md:text-4xl">SHOPPING, REIMAGINED.</h2>
          <p className="mt-6 text-sm leading-relaxed text-muted-foreground md:text-base">
            EVARA learns what matters to you — your taste, your moments and the way you want to feel — then helps you
            discover what belongs in your world.
          </p>
        </div>

        <div className="mx-auto mt-16 grid max-w-4xl grid-cols-1 gap-px overflow-hidden border border-border sm:grid-cols-3">
          {CONCEPTS.map((concept) => (
            <div key={concept.title} className="bg-background px-8 py-10 text-center sm:border-l sm:border-border sm:first:border-l-0">
              <p className="font-display text-lg tracking-wide text-accent">{concept.title}</p>
              <p className="mt-3 text-sm text-muted-foreground">{concept.line}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}
