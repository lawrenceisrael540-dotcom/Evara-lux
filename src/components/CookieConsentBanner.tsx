import { useEffect, useState } from 'react'
import { Link } from '@tanstack/react-router'
import { useConvexAuth, useMutation } from 'convex/react'
import { api } from '../../convex/_generated/api'

const STORAGE_KEY = 'evara_cookie_consent' // "accepted" | "declined"

// Exposes the current choice to any future analytics/tracking init code,
// without those scripts needing to read localStorage or know this
// component exists: `if (window.evaraCookieConsent?.get() === 'accepted') { ... }`
declare global {
  interface Window {
    evaraCookieConsent?: { get: () => 'accepted' | 'declined' | null }
  }
}

export function CookieConsentBanner() {
  const { isAuthenticated } = useConvexAuth()
  const recordConsent = useMutation(api.legal.recordConsent)
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    window.evaraCookieConsent = {
      get: () => (localStorage.getItem(STORAGE_KEY) as 'accepted' | 'declined' | null) ?? null,
    }
    if (!localStorage.getItem(STORAGE_KEY)) setVisible(true)

    const reopen = () => setVisible(true)
    window.addEventListener('evara:open-cookie-settings', reopen)
    return () => window.removeEventListener('evara:open-cookie-settings', reopen)
  }, [])

  function choose(choice: 'accepted' | 'declined') {
    localStorage.setItem(STORAGE_KEY, choice)
    setVisible(false)
    if (isAuthenticated && choice === 'accepted') {
      // The server owns the canonical policy version; this records acceptance of
      // the current policy instead of incorrectly storing "accepted" as a version.
      void recordConsent({ kind: 'cookie_consent' }).catch(() => {})
    }
  }

  if (!visible) return null

  return (
    <div
      role="dialog"
      aria-label="Cookie preferences"
      className="fixed inset-x-0 bottom-0 z-[90] border-t border-border bg-background/95 px-6 py-5 backdrop-blur-md md:px-10"
    >
      <div className="mx-auto flex max-w-[1400px] flex-col items-start gap-4 md:flex-row md:items-center md:justify-between">
        <p className="max-w-[60ch] text-xs leading-relaxed text-muted-foreground">
          We use essential cookies to run EVARA-LUX (sign-in, cart) and, only if you accept, optional cookies to understand
          how the site is used. See our{' '}
          <Link to="/legal/cookies" className="text-foreground underline underline-offset-4">
            Cookie Policy
          </Link>
          .
        </p>
        <div className="flex shrink-0 items-center gap-3">
          <button
            type="button"
            onClick={() => choose('declined')}
            className="border border-border px-4 py-2.5 text-[11px] uppercase tracking-[0.12em] text-foreground transition-colors hover:border-foreground"
          >
            Decline non-essential
          </button>
          <button
            type="button"
            onClick={() => choose('accepted')}
            className="bg-foreground px-4 py-2.5 text-[11px] uppercase tracking-[0.12em] text-background transition-opacity hover:opacity-90"
          >
            Accept all
          </button>
        </div>
      </div>
    </div>
  )
}
