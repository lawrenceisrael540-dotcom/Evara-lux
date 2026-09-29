import { Instagram, Twitter } from 'lucide-react'
import { Link } from '@tanstack/react-router'

type FooterLink = { label: string; href?: string; to?: string }

const COLUMNS: { title: string; links: FooterLink[] }[] = [
  {
    title: 'SHOP',
    links: [
      { label: 'New Arrivals', href: '#featured-collection' },
      { label: 'Collections', href: '#shop-the-feeling' },
      { label: 'Discover', href: '#intelligence' },
    ],
  },
  {
    title: 'COMPANY',
    links: [
      { label: 'About EVARA', href: '#editorial' },
      { label: 'Journal' },
      { label: 'Contact' },
    ],
  },
  {
    title: 'SUPPORT',
    links: [{ label: 'Shipping' }, { label: 'Returns', to: '/legal/refund' }, { label: 'FAQ' }],
  },
  {
    title: 'ACCOUNT',
    links: [{ label: 'My Account', to: '/account' }, { label: 'Wishlist' }, { label: 'Orders' }],
  },
  {
    title: 'LEGAL',
    links: [
      { label: 'Privacy Policy', to: '/legal/privacy' },
      { label: 'Terms of Service', to: '/legal/terms' },
      { label: 'Refund Policy', to: '/legal/refund' },
      { label: 'Cookie Policy', to: '/legal/cookies' },
    ],
  },
]

function FooterCell({ link }: { link: FooterLink }) {
  const className = 'text-sm text-muted-foreground transition-colors duration-300 hover:text-foreground'
  if (link.to) {
    return (
      <Link to={link.to} className={className}>
        {link.label}
      </Link>
    )
  }
  if (link.href) {
    return (
      <a href={link.href} className={className}>
        {link.label}
      </a>
    )
  }
  // Page not built yet — rendered as a quiet placeholder rather than a dead link.
  return <span className={`${className} cursor-default`}>{link.label}</span>
}

export function Footer() {
  return (
    <footer className="border-t border-border bg-background">
      <div className="mx-auto max-w-[1400px] px-6 pb-10 pt-20 md:px-10">
        <div className="grid grid-cols-2 gap-10 md:grid-cols-7">
          <div className="col-span-2 md:col-span-2">
            <span className="font-display text-lg font-medium tracking-[0.14em] text-foreground">
              EVARA<span className="text-accent">·</span>LUX
            </span>
            <p className="mt-4 max-w-[26ch] font-display text-sm text-muted-foreground">MORE THAN WHAT YOU BUY.</p>
          </div>

          {COLUMNS.map((column) => (
            <div key={column.title}>
              <p className="text-[11px] font-medium tracking-[0.2em] text-foreground">{column.title}</p>
              <ul className="mt-5 flex flex-col gap-3">
                {column.links.map((link) => (
                  <li key={link.label}>
                    <FooterCell link={link} />
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        <div className="mt-16 flex flex-col items-center justify-between gap-6 border-t border-border pt-8 sm:flex-row">
          <p className="text-xs text-muted-foreground">© {new Date().getFullYear()} EVARA-LUX. All rights reserved.</p>
          <div className="flex items-center gap-5 text-muted-foreground">
            <button
              type="button"
              onClick={() => window.dispatchEvent(new Event('evara:open-cookie-settings'))}
              className="text-xs text-muted-foreground underline underline-offset-4 hover:text-foreground"
            >
              Manage cookies
            </button>
            <Instagram className="h-4 w-4" strokeWidth={1.5} />
            <Twitter className="h-4 w-4" strokeWidth={1.5} />
          </div>
        </div>

        {/* DRAFT business identification block — bracketed fields need real
            business facts (company legal name, registered address, business
            registration/VAT number if applicable) before this is accurate. */}
        <div className="mt-6 border-t border-border pt-6">
          <p className="text-[11px] leading-relaxed text-muted-foreground">
            EVARA-LUX is operated by <span className="text-foreground">[LEGAL COMPANY NAME]</span>, <span className="text-foreground">[BUSINESS ADDRESS]</span>.
            {' '}Support: <span className="text-foreground">[SUPPORT EMAIL]</span>.
          </p>
        </div>
      </div>
    </footer>
  )
}
