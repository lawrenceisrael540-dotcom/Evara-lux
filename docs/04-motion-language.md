# 04. Motion language

Animation communicates hierarchy, change, cause and effect, state, progression, intelligence, or emotion. If it does none of these, remove it.

## Tempos

| Tempo | Micro / short / medium / long (ms) | Easing | Purpose |
| --- | --- | --- | --- |
| slow | 160 / 320 / 640 / 1100 | emphasized | Weight and certainty; change arrives deliberately |
| measured | 120 / 220 / 420 / 720 | standard | Clarity; motion explains what changed, then stops |
| brisk | 90 / 160 / 280 / 480 | snap | Responsiveness; the system keeps up with the operator |
| kinetic | 80 / 140 / 240 / 400 | snap | Momentum; energy that leads the eye to an action |

Source of truth: `src/design/motion.ts`.

## Rules

1. **One orchestrated moment per view.** A single entrance or reveal beats scattered effects.
2. **Respond to the person.** Motion triggered by an action (open, expand, confirm) is always welcome. Unprompted motion is used sparingly to draw attention.
3. **Animate transform and opacity.** Avoid animating layout properties.
4. **At most 6 concurrent animations** (`budgets.maxConcurrentAnimations`).
5. **Never loop attention-grabbing motion** on content the person is trying to read.

## Reduced motion contract

When `prefers-reduced-motion: reduce` is set, `motionFor(tempo, true)` returns:

- every duration at most 120 ms, micro at 0
- linear easing, no stagger
- only `opacity` may animate

`base.css` enforces the same as a CSS backstop. `npm run verify` tests it for every tempo. Video autoplay, parallax and looping atmosphere layers are disabled under this setting.

## Signature motion per aura

| Aura | Signature |
| --- | --- |
| Obsidian Command | Slow reveals, precise alignment, no bounce |
| Midnight Ledger | Numbers settle; rows highlight without moving |
| Velvet Product | Cinematic light sweeps across the object |
| Signal Marketing | Fast wipes and kinetic type that point at the call to action |
| Orbit Customer | Soft, organic easing; history unfolds gently |
| Flowline Operations | Continuous, mechanical flow that stalls visibly at a bottleneck |
| Neural Atlas | Data reveals in layers; depth changes with focus |
| Sentinel Security | Sharp, minimal state changes; alerts snap in |
| Chorus Agents | Each agent has its own rhythm; activity is visible |
