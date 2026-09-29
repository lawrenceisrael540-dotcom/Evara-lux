import { useId } from 'react'

type EvaraLoaderProps = {
  /** 'stage' fills its container as a full loading moment; 'inline' sits next to text (e.g. a button). */
  variant?: 'stage' | 'inline'
  size?: number
  label?: string
  sublabel?: string
  /** 0–100. Omit for an indeterminate sweep (most cases: we rarely know true progress). */
  progress?: number
  className?: string
}

const FACES = [
  { name: 'front', transform: (s: number) => `translateZ(${s / 2}px)` },
  { name: 'back', transform: (s: number) => `rotateY(180deg) translateZ(${s / 2}px)` },
  { name: 'right', transform: (s: number) => `rotateY(90deg) translateZ(${s / 2}px)` },
  { name: 'left', transform: (s: number) => `rotateY(-90deg) translateZ(${s / 2}px)` },
  { name: 'top', transform: (s: number) => `rotateX(90deg) translateZ(${s / 2}px)` },
  { name: 'bottom', transform: (s: number) => `rotateX(-90deg) translateZ(${s / 2}px)` },
] as const

const PARTICLES = [
  { delay: '0s', duration: '5.5s', radius: 1.9, z: 18 },
  { delay: '-1.8s', duration: '6.5s', radius: 1.55, z: -14 },
  { delay: '-3.4s', duration: '7.5s', radius: 2.2, z: 8 },
]

/**
 * The EVARA-LUX loading emblem: a small faceted gem rendered with real CSS 3D
 * transforms (perspective + preserve-3d), not a spinner GIF. Used full-stage
 * during auth provisioning / route transitions, or inline within a button.
 * Automatically collapses to a still, tilted gem under prefers-reduced-motion
 * (handled globally in styles.css).
 */
export function EvaraLoader({
  variant = 'stage',
  size,
  label,
  sublabel,
  progress,
  className = '',
}: EvaraLoaderProps) {
  const gemSize = size ?? (variant === 'stage' ? 72 : 20)
  const titleId = useId()
  const indeterminate = progress === undefined

  const gem = (
    <div
      className="evara-loader-scene"
      style={{ width: gemSize, height: gemSize }}
      role="img"
      aria-labelledby={label ? titleId : undefined}
      aria-label={label ? undefined : 'Loading'}
    >
      <div className="evara-loader-glow" aria-hidden="true" />
      <div className="evara-loader-ring" aria-hidden="true" />
      {PARTICLES.map((p, i) => (
        <div
          key={i}
          className="evara-loader-particle"
          aria-hidden="true"
          style={{
            // @ts-expect-error -- custom property for the orbit keyframe
            '--orbit-radius': `${gemSize / 2 + p.radius * 10}px`,
            animationDuration: p.duration,
            animationDelay: p.delay,
            transform: `translateZ(${p.z}px)`,
          }}
        />
      ))}
      <div className="evara-loader-gem" style={{ width: gemSize, height: gemSize }}>
        {FACES.map((f) => (
          <div
            key={f.name}
            className="evara-loader-face"
            style={{ transform: f.transform(gemSize) }}
          />
        ))}
        <div className="evara-loader-core">
          <span className="evara-loader-mark" style={{ fontSize: gemSize * 0.34 }}>
            E
          </span>
        </div>
      </div>
    </div>
  )

  if (variant === 'inline') {
    return <span className={`inline-flex items-center ${className}`}>{gem}</span>
  }

  return (
    <div
      className={`flex min-h-screen flex-col items-center justify-center gap-8 bg-background px-6 ${className}`}
      role="status"
      aria-live="polite"
    >
      {gem}
      <div className="flex flex-col items-center gap-2 text-center">
        {label && (
          <p id={titleId} className="font-display text-lg tracking-[0.02em] text-foreground">
            {label}
          </p>
        )}
        {sublabel && (
          <p className="max-w-[32ch] text-sm leading-relaxed text-muted-foreground">{sublabel}</p>
        )}
      </div>
      <div className="evara-loader-track h-[2px] w-48 rounded-full">
        <div
          className={`evara-loader-fill ${indeterminate ? 'is-indeterminate' : ''}`}
          style={indeterminate ? undefined : { width: `${Math.max(4, Math.min(100, progress))}%` }}
        />
      </div>
    </div>
  )
}
