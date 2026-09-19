# 05. Quality gates

Nothing ships unless it passes these. Numbers are defaults to tune per project, measured on a mid-tier phone over a typical mobile connection.

## Automated (CI)

| Check | Threshold |
| --- | --- |
| Aura contrast | Body 7:1, secondary 4.5:1, accent and signal 4.5:1 |
| Registry distinctness | No duplicate ids or routes; no clashing section, composition and aura |
| Compact vs expanded | Compositions must differ |
| Reduced motion | Every tempo collapses to an opacity fade of 120 ms or less |
| Largest Contentful Paint | 2500 ms or less (p75) |
| Interaction to Next Paint | 200 ms or less (p75) |
| Cumulative Layout Shift | 0.1 or less |
| Route JavaScript | 170 KB gzip or less per route |
| Hero video on mobile | 2.5 MB or less, muted, poster required |

Run today with `npm run verify`. Add Lighthouse CI and an automated accessibility scan (axe) in phase 2.

## Manual

- Keyboard-only pass of every new page, with visible focus at all times
- Screen reader pass on the main task
- Reduced-motion pass and data-saver pass
- Check on a real mid-tier phone and one ultrawide monitor
- Touch targets at least 44 px

## The final design test

Answer before completing a page:

1. Does this feel like a template?
2. Could another SaaS company have this exact page?
3. Does the design match the page's name?
4. Does it match the content?
5. Does the motion match the aura?
6. Does the video influence the experience?
7. Is the composition genuinely different from other pages?
8. Is that difference meaningful rather than cosmetic?
9. Is it still unmistakably EVARA-LUX?
10. Is it fast?
11. Is it accessible?
12. Is it useful?

If the answer to 1 or 2 is yes, redesign.

## Consistency

Uniqueness must not become chaos. These stay identical everywhere: accessibility, interaction conventions, navigation logic, core typography, spacing logic, component behaviour, performance standards, security and responsive rules.
