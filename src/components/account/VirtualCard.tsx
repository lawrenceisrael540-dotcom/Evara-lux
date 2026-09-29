import { useRef, useState } from 'react'
import type { Tier } from '@/lib/evara-ecosystem/loyalty'

type VirtualCardProps = {
  tier: Tier
  displayName: string
  referralCode: string
  points: number
  coins: number
}

/**
 * The EVARA-LUX virtual card. Real 3D: a perspective scene that tilts with
 * the pointer (mouse/touch), not a flat image. Palette, foil and emblem all
 * come from the customer's tier theme — the card visibly changes as someone
 * moves up the house system.
 */
export function VirtualCard({ tier, displayName, referralCode, points, coins }: VirtualCardProps) {
  const sceneRef = useRef<HTMLDivElement>(null)
  const [tilt, setTilt] = useState({ rx: 8, ry: -10 })
  const [active, setActive] = useState(false)

  function handlePointerMove(e: React.PointerEvent<HTMLDivElement>) {
    const el = sceneRef.current
    if (!el) return
    const rect = el.getBoundingClientRect()
    const px = (e.clientX - rect.left) / rect.width // 0..1
    const py = (e.clientY - rect.top) / rect.height
    setTilt({ rx: (0.5 - py) * 18, ry: (px - 0.5) * 22 })
  }

  const [a, b, c] = tier.theme.gradient

  return (
    <div
      ref={sceneRef}
      className="[perspective:1400px]"
      onPointerMove={handlePointerMove}
      onPointerEnter={() => setActive(true)}
      onPointerLeave={() => {
        setActive(false)
        setTilt({ rx: 8, ry: -10 })
      }}
      role="img"
      aria-label={`EVARA-LUX ${tier.name} card for ${displayName}`}
    >
      <div
        className="relative aspect-[16/10] w-full max-w-[420px] rounded-[10px] transition-transform duration-300 ease-out [transform-style:preserve-3d]"
        style={{
          transform: `rotateX(${tilt.rx}deg) rotateY(${tilt.ry}deg) scale(${active ? 1.02 : 1})`,
          background: `linear-gradient(135deg, ${a}, ${b} 55%, ${c})`,
          boxShadow: active
            ? `0 30px 60px -20px ${tier.theme.accent}55, 0 0 0 1px ${tier.theme.accent}33`
            : `0 18px 40px -22px ${tier.theme.accent}40, 0 0 0 1px ${tier.theme.accent}22`,
        }}
      >
        {/* Foil sweep that tracks the tilt */}
        <div
          className="pointer-events-none absolute inset-0 rounded-[10px] opacity-70 mix-blend-screen"
          style={{
            background: `linear-gradient(${115 + tilt.ry * 2}deg, transparent 30%, ${tier.theme.foil} 48%, transparent 66%)`,
          }}
        />
        {/* Faint texture grid, tier-tinted */}
        <div
          className="pointer-events-none absolute inset-0 rounded-[10px] opacity-[0.25]"
          style={{
            backgroundImage: `linear-gradient(${tier.theme.accent}22 1px, transparent 1px), linear-gradient(90deg, ${tier.theme.accent}22 1px, transparent 1px)`,
            backgroundSize: '22px 22px',
            maskImage: 'radial-gradient(85% 85% at 30% 20%, black, transparent)',
          }}
        />

        <div className="relative flex h-full flex-col justify-between p-6 [transform:translateZ(24px)]">
          <div className="flex items-start justify-between">
            <div>
              <p className="font-display text-[13px] tracking-[0.22em] text-[--card-ink]" style={{ ['--card-ink' as any]: tier.theme.accentSoft }}>
                EVARA · LUX
              </p>
              <p className="mt-1 text-[10px] uppercase tracking-[0.28em]" style={{ color: `${tier.theme.accentSoft}99` }}>
                {tier.name} member
              </p>
            </div>
            <span className="text-2xl" style={{ color: tier.theme.accentSoft, textShadow: `0 0 16px ${tier.theme.accent}80` }}>
              {tier.theme.emblem}
            </span>
          </div>

          <div>
            <p className="font-display text-lg tracking-[0.04em] text-[#F5F1E8]">{displayName}</p>
            <div className="mt-3 flex items-end justify-between">
              <div className="flex gap-6">
                <div>
                  <p className="text-[9px] uppercase tracking-[0.2em]" style={{ color: `${tier.theme.accentSoft}88` }}>
                    NEXA Points
                  </p>
                  <p className="font-display text-sm text-[#F5F1E8]">{points.toLocaleString()}</p>
                </div>
                <div>
                  <p className="text-[9px] uppercase tracking-[0.2em]" style={{ color: `${tier.theme.accentSoft}88` }}>
                    NEXA Coins
                  </p>
                  <p className="font-display text-sm text-[#F5F1E8]">{coins.toLocaleString()}</p>
                </div>
              </div>
              <p className="font-mono text-[11px] tracking-[0.14em]" style={{ color: `${tier.theme.accentSoft}aa` }}>
                {referralCode}
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
