import { useReveal } from '@/hooks/use-reveal'

const TILES = [
  { name: 'CONFIDENCE', line: 'Pieces that make an entrance.', hue: '39 42% 61%', span: 'md:col-span-3 md:row-span-2' },
  { name: 'DESIRE', line: 'Made to be remembered.', hue: '10 45% 45%', span: 'md:col-span-3 md:row-span-1' },
  { name: 'CALM', line: 'Designed for your quiet moments.', hue: '173 25% 40%', span: 'md:col-span-3 md:row-span-1' },
  { name: 'POWER', line: 'Presence without explanation.', hue: '0 0% 30%', span: 'md:col-span-3 md:row-span-1' },
  { name: 'DISCOVERY', line: 'For the curious.', hue: '39 30% 55%', span: 'md:col-span-3 md:row-span-1' },
]

function Tile({ tile }: { tile: (typeof TILES)[number] }) {
  const { ref, visible } = useReveal<HTMLAnchorElement>()
  return (
    <a
      ref={ref}
      href="#featured-collection"
      className={`evara-reveal group relative flex min-h-[220px] flex-col justify-end overflow-hidden border border-border p-7 transition-colors duration-500 hover:border-foreground/40 ${tile.span} ${visible ? 'is-visible' : ''}`}
    >
      <div
        className="absolute inset-0 opacity-70 transition-transform duration-700 ease-[cubic-bezier(0.16,1,0.3,1)] group-hover:scale-105"
        style={{
          background: `radial-gradient(140% 100% at 20% 100%, hsl(${tile.hue} / 0.28), transparent 65%)`,
        }}
      />
      <div className="relative">
        <h3 className="font-display text-2xl tracking-wide text-foreground">{tile.name}</h3>
        <p className="mt-2 max-w-[24ch] text-sm text-muted-foreground">{tile.line}</p>
      </div>
    </a>
  )
}

export function ShopTheFeeling() {
  const { ref, visible } = useReveal<HTMLParagraphElement>()
  return (
    <section id="shop-the-feeling" className="border-t border-border bg-background py-28">
      <div className="mx-auto max-w-[1400px] px-6 md:px-10">
        <p
          ref={ref}
          className={`evara-reveal font-display text-3xl tracking-tight text-foreground md:text-4xl ${visible ? 'is-visible' : ''}`}
        >
          SHOP THE FEELING.
        </p>

        <div className="mt-12 grid grid-cols-1 gap-4 md:grid-cols-6">
          {TILES.map((tile) => (
            <Tile key={tile.name} tile={tile} />
          ))}
        </div>
      </div>
    </section>
  )
}
