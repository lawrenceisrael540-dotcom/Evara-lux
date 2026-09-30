import { useEffect, useState } from 'react'
import { Link, useNavigate } from '@tanstack/react-router'
import { useMutation, useQuery } from 'convex/react'
import {
  Heart, Menu, Search, ShoppingBag, User, X, House, Sparkles, Bell,
  UsersRound, Settings, Coins, ArrowRight, Building2,
} from 'lucide-react'
import { api } from '../../../convex/_generated/api'
import { formatMoney } from '@/lib/utils'

type RoutePath =
  | '/'
  | '/catalog'
  | '/command'
  | '/feed'
  | '/dashboard/ai'
  | '/dashboard/social'
  | '/nexa'
  | '/settings'
  | '/brands'
  | '/banking'
  | '/notifications'
type NavLink = { label: string; to: RoutePath } | { label: string; href: string }

const DESKTOP_LINKS: NavLink[] = [
  { label: 'Home', to: '/' },
  { label: 'Command', to: '/command' },
  { label: 'New Arrivals', href: '#featured-collection' },
  { label: 'Shop', to: '/catalog' },
  { label: 'Social', to: '/dashboard/social' },
  { label: 'AI', to: '/dashboard/ai' },
  { label: 'NEXA', to: '/nexa' },
  { label: 'Brands', to: '/brands' },
]

const MOBILE_LINKS: NavLink[] = [
  { label: 'Home', to: '/' },
  { label: 'Command', to: '/command' },
  { label: 'New Arrivals', href: '#featured-collection' },
  { label: 'Shop', to: '/catalog' },
  { label: 'Social', to: '/dashboard/social' },
  { label: 'AI Intelligence', to: '/dashboard/ai' },
  { label: 'NEXA Coin Shop', to: '/nexa' },
  { label: 'Settings', to: '/settings' },
  { label: 'Brand Network', to: '/brands' },
  { label: 'EVARA Banking', to: '/banking' },
  { label: 'About', href: '#editorial' },
]

function Wordmark({ className = '' }: { className?: string }) {
  return (
    <span className={`font-display text-[1.15rem] font-medium tracking-[0.14em] text-foreground ${className}`}>
      EVARA<span className="text-accent">·</span>LUX
    </span>
  )
}

function DrawerShell({
  open, onClose, title, children,
}: {
  open: boolean
  onClose: () => void
  title: string
  children: React.ReactNode
}) {
  return (
    <div
      className={`fixed inset-0 z-[70] transition-opacity duration-300 ${open ? 'pointer-events-auto opacity-100' : 'pointer-events-none opacity-0'}`}
      aria-hidden={!open}
    >
      <div className="absolute inset-0 bg-background/70 backdrop-blur-sm" onClick={onClose} />
      <div
        className={`absolute right-0 top-0 flex h-full w-full max-w-sm flex-col border-l border-border bg-card transition-transform duration-500 ease-[cubic-bezier(0.16,1,0.3,1)] ${open ? 'translate-x-0' : 'translate-x-full'}`}
      >
        <div className="flex shrink-0 items-center justify-between px-6 py-6">
          <span className="font-display text-sm tracking-[0.2em] text-foreground">{title}</span>
          <button type="button" onClick={onClose} aria-label="Close" className="text-muted-foreground hover:text-foreground">
            <X className="h-5 w-5" strokeWidth={1.5} />
          </button>
        </div>
        {children}
      </div>
    </div>
  )
}

function EmptyState({ label }: { label: string }) {
  return (
    <div className="flex h-full flex-col items-center justify-center gap-3 px-6 text-center">
      <p className="font-display text-lg text-foreground">{label}</p>
      <p className="max-w-[22ch] text-sm leading-relaxed text-muted-foreground">
        Pieces you save will appear here, ready whenever you are.
      </p>
    </div>
  )
}

function CartPanel({ open, onClose }: { open: boolean; onClose: () => void }) {
  const cart = useQuery(api.cart.getMyCart, open ? {} : 'skip')
  const setQuantity = useMutation(api.cart.setQuantity)
  const navigate = useNavigate()
  const items = cart && cart.ok ? cart.items : []
  const unauthenticated = cart && !cart.ok

  return (
    <DrawerShell open={open} onClose={onClose} title="YOUR CART">
      {unauthenticated && <EmptyState label="Sign in to see your cart." />}
      {!unauthenticated && cart === undefined && (
        <div className="flex h-full items-center justify-center"><p className="text-sm text-muted-foreground">Loading…</p></div>
      )}
      {!unauthenticated && cart && cart.ok && items.length === 0 && <EmptyState label="Your cart is empty." />}
      {!unauthenticated && cart && cart.ok && items.length > 0 && (
        <>
          <div className="flex-1 overflow-y-auto px-6">
            <ul className="flex flex-col gap-5 pb-6">
              {items.map((item) => (
                <li key={item._id} className="flex gap-4">
                  <div className="h-20 w-16 shrink-0 overflow-hidden bg-background">
                    {item.productImage && <img src={item.productImage} alt={item.productName} className="h-full w-full object-cover" />}
                  </div>
                  <div className="flex flex-1 flex-col justify-between">
                    <div>
                      <Link to="/product/$slug" params={{ slug: item.productSlug }} onClick={onClose} className="line-clamp-2 text-sm text-foreground hover:underline">
                        {item.productName}
                      </Link>
                      <p className="mt-1 text-xs text-muted-foreground">{formatMoney(item.unitPriceMinor, cart.currency)}</p>
                    </div>
                    <div className="flex items-center justify-between">
                      <div className="flex items-center border border-border">
                        <button type="button" aria-label="Decrease quantity" onClick={() => setQuantity({ cartItemId: item._id, quantity: item.quantity - 1 })} className="px-2 py-1 text-xs hover:bg-background">−</button>
                        <span className="min-w-[1.75rem] text-center text-xs">{item.quantity}</span>
                        <button type="button" aria-label="Increase quantity" onClick={() => setQuantity({ cartItemId: item._id, quantity: item.quantity + 1 })} className="px-2 py-1 text-xs hover:bg-background">+</button>
                      </div>
                      <button type="button" onClick={() => setQuantity({ cartItemId: item._id, quantity: 0 })} className="text-[11px] uppercase tracking-[0.1em] text-muted-foreground underline underline-offset-4 hover:text-foreground">Remove</button>
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          </div>
          <div className="shrink-0 border-t border-border px-6 py-6">
            <div className="mb-4 flex items-center justify-between text-sm">
              <span className="text-muted-foreground">Subtotal</span>
              <span className="font-display text-foreground">{formatMoney(cart.subtotalMinor, cart.currency)}</span>
            </div>
            <button type="button" onClick={() => { onClose(); navigate({ to: '/checkout' }) }} className="w-full bg-foreground py-3 text-[13px] font-medium uppercase tracking-[0.14em] text-background hover:opacity-90">
              Checkout
            </button>
          </div>
        </>
      )}
    </DrawerShell>
  )
}

function SearchBoard({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [query, setQuery] = useState('')
  const [debounced, setDebounced] = useState('')
  useEffect(() => {
    const t = setTimeout(() => setDebounced(query.trim()), 200)
    return () => clearTimeout(t)
  }, [query])
  const active = debounced.length >= 2
  const people = useQuery(api.authz.searchProfiles, active ? { prefix: debounced } : 'skip')
  const products = useQuery(api.products.search, active ? { text: debounced } : 'skip')

  function closeAndClear() { onClose(); setQuery('') }
  if (!open) return null

  return (
    <div className="hidden border-t border-border bg-background/95 px-10 py-4 backdrop-blur-md md:block">
      <div className="mx-auto max-w-[1400px]">
        <div className="flex items-center gap-3">
          <Search className="h-4 w-4 text-muted-foreground" strokeWidth={1.5} />
          <input autoFocus type="text" value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search products or @username" className="w-full bg-transparent font-display text-lg text-foreground placeholder:text-muted-foreground focus:outline-none" />
          <button type="button" onClick={closeAndClear} aria-label="Close search" className="text-muted-foreground hover:text-foreground"><X className="h-4 w-4" strokeWidth={1.5} /></button>
        </div>
        {active && (
          <div className="mt-4 grid grid-cols-1 gap-6 border-t border-border pt-4 md:grid-cols-2">
            <div>
              <p className="mb-2 text-[10px] uppercase tracking-[0.16em] text-muted-foreground">Products</p>
              {products === undefined && <p className="text-sm text-muted-foreground">Searching…</p>}
              {products && products.length === 0 && <p className="text-sm text-muted-foreground">No products match "{debounced}".</p>}
              {products && products.length > 0 && (
                <ul className="flex flex-col gap-1">
                  {products.map((p) => (
                    <li key={p._id}>
                      <Link to="/product/$slug" params={{ slug: p.slug }} onClick={closeAndClear} className="flex items-center gap-3 py-2 text-sm hover:text-accent">
                        {p.images[0] && <img src={p.images[0]} alt="" className="h-10 w-8 shrink-0 object-cover" />}
                        <span className="line-clamp-1">{p.name}</span>
                        <span className="ml-auto shrink-0 text-xs text-muted-foreground">{formatMoney(p.priceMinor, p.currency)}</span>
                      </Link>
                    </li>
                  ))}
                </ul>
              )}
            </div>
            <div>
              <p className="mb-2 text-[10px] uppercase tracking-[0.16em] text-muted-foreground">Members</p>
              {people === undefined && <p className="text-sm text-muted-foreground">Searching…</p>}
              {people && people.length === 0 && <p className="text-sm text-muted-foreground">No one matches "@{debounced}".</p>}
              {people && people.length > 0 && (
                <ul className="flex flex-col gap-1">
                  {people.map((p) => (
                    <li key={p.userId}>
                      <Link to="/u/$username" params={{ username: p.username }} onClick={closeAndClear} className="flex items-center gap-3 py-2 text-sm hover:text-accent">
                        <span className="font-display">@{p.username}</span>
                        {p.displayName && <span className="text-muted-foreground">{p.displayName}</span>}
                      </Link>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

function NavIconLink({ to, label, icon: Icon }: { to: RoutePath; label: string; icon: typeof House }) {
  return (
    <Link to={to} aria-label={label} className="text-muted-foreground transition-colors hover:text-foreground">
      <Icon className="h-[18px] w-[18px]" strokeWidth={1.5} />
    </Link>
  )
}

export function Navbar() {
  const [scrolled, setScrolled] = useState(false)
  const [mobileOpen, setMobileOpen] = useState(false)
  const [searchOpen, setSearchOpen] = useState(false)
  const [cartOpen, setCartOpen] = useState(false)
  const [wishlistOpen, setWishlistOpen] = useState(false)
  const cartBadge = useQuery(api.cart.getMyCart)
  const itemCount = cartBadge && cartBadge.ok ? cartBadge.items.reduce((n, i) => n + i.quantity, 0) : 0
  const unreadNotifications = useQuery(api.notifications.unreadCount) ?? 0

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 24)
    onScroll()
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  return (
    <>
      <header className={`fixed inset-x-0 top-0 z-50 transition-all duration-500 ${scrolled ? 'border-b border-border bg-background/85 backdrop-blur-md' : 'border-b border-transparent bg-gradient-to-b from-background/60 to-transparent'}`}>
        <nav className="mx-auto flex h-[76px] max-w-[1400px] items-center justify-between px-6 md:px-10">
          <Link to="/" className="shrink-0" aria-label="EVARA-LUX Home"><Wordmark /></Link>

          <ul className="hidden items-center gap-7 lg:flex">
            {DESKTOP_LINKS.map((link) =>
              'to' in link ? (
                <li key={link.label}><Link to={link.to} className="text-[12px] font-medium tracking-[0.08em] text-muted-foreground transition-colors hover:text-foreground">{link.label}</Link></li>
              ) : (
                <li key={link.label}><a href={link.href} className="text-[12px] font-medium tracking-[0.08em] text-muted-foreground transition-colors hover:text-foreground">{link.label}</a></li>
              ),
            )}
          </ul>

          <div className="flex items-center gap-4">
            <div className="hidden items-center gap-4 lg:flex">
              <NavIconLink to="/" label="Home" icon={House} />
              <NavIconLink to="/dashboard/ai" label="AI Intelligence" icon={Sparkles} />
              <NavIconLink to="/dashboard/social" label="Social" icon={UsersRound} />
              <NavIconLink to="/nexa" label="NEXA Coin Shop" icon={Coins} />
              <NavIconLink to="/settings" label="Settings" icon={Settings} />
              <NavIconLink to="/brands" label="Brand Network" icon={Building2} />
              <NavIconLink to="/notifications" label="Notifications" icon={Bell} />
            </div>
            <button type="button" onClick={() => setSearchOpen((s) => !s)} aria-label="Search" className="hidden text-muted-foreground hover:text-foreground md:block"><Search className="h-[18px] w-[18px]" strokeWidth={1.5} /></button>
            <button type="button" onClick={() => setWishlistOpen(true)} aria-label="Wishlist" className="hidden text-muted-foreground hover:text-foreground md:block"><Heart className="h-[18px] w-[18px]" strokeWidth={1.5} /></button>
            <Link to="/notifications" aria-label="Notifications" className="relative hidden text-muted-foreground hover:text-foreground md:block"><Bell className="h-[18px] w-[18px]" strokeWidth={1.5} />{unreadNotifications>0&&<span className="absolute -right-2 -top-2 flex h-4 min-w-4 items-center justify-center rounded-full bg-accent px-1 text-[9px] font-medium text-background">{unreadNotifications>9?"9+":unreadNotifications}</span>}</Link>
            <Link to="/account" aria-label="Account" className="hidden text-muted-foreground hover:text-foreground md:block"><User className="h-[18px] w-[18px]" strokeWidth={1.5} /></Link>
            <button type="button" onClick={() => setCartOpen(true)} aria-label="Cart" className="relative text-muted-foreground hover:text-foreground">
              <ShoppingBag className="h-[18px] w-[18px]" strokeWidth={1.5} />
              {itemCount > 0 && <span className="absolute -right-2 -top-2 flex h-4 w-4 items-center justify-center rounded-full bg-accent text-[9px] font-medium text-background">{itemCount > 9 ? '9+' : itemCount}</span>}
            </button>
            <button type="button" onClick={() => setMobileOpen(true)} aria-label="Menu" className="text-foreground md:hidden"><Menu className="h-5 w-5" strokeWidth={1.5} /></button>
          </div>
        </nav>
        <SearchBoard open={searchOpen} onClose={() => setSearchOpen(false)} />
      </header>

      <div className={`fixed inset-0 z-[60] overflow-y-auto bg-background transition-opacity duration-300 md:hidden ${mobileOpen ? 'pointer-events-auto opacity-100' : 'pointer-events-none opacity-0'}`}>
        <div className="flex h-[76px] items-center justify-between px-6">
          <Link to="/" onClick={() => setMobileOpen(false)} aria-label="EVARA-LUX Home"><Wordmark /></Link>
          <button type="button" onClick={() => setMobileOpen(false)} aria-label="Close menu" className="text-foreground"><X className="h-5 w-5" strokeWidth={1.5} /></button>
        </div>

        <div className="mx-6 mt-5 border-y border-border py-4">
          <p className="text-[9px] uppercase tracking-[0.24em] text-muted-foreground">EVARA COMMAND</p>
        </div>

        <ul className="flex flex-col px-6">
          {MOBILE_LINKS.map((link) =>
            'to' in link ? (
              <li key={link.label} className="border-b border-border">
                <Link to={link.to} onClick={() => setMobileOpen(false)} className="flex items-center justify-between py-5 font-display text-[1.35rem] text-foreground">
                  <span>{link.label}</span><ArrowRight className="h-4 w-4 text-muted-foreground" strokeWidth={1.5} />
                </Link>
              </li>
            ) : (
              <li key={link.label} className="border-b border-border">
                <a href={link.href} onClick={() => setMobileOpen(false)} className="flex items-center justify-between py-5 font-display text-[1.35rem] text-foreground">
                  <span>{link.label}</span><ArrowRight className="h-4 w-4 text-muted-foreground" strokeWidth={1.5} />
                </a>
              </li>
            ),
          )}
        </ul>

        <div className="grid grid-cols-2 gap-3 px-6 py-7">
          <button type="button" onClick={() => { setWishlistOpen(true); setMobileOpen(false) }} className="flex items-center gap-2 border border-border px-4 py-3 text-left text-sm text-muted-foreground hover:text-foreground">
            <Heart className="h-4 w-4" strokeWidth={1.5} /> Wishlist
          </button>
          <Link to="/account" onClick={() => setMobileOpen(false)} className="flex items-center gap-2 border border-border px-4 py-3 text-sm text-muted-foreground hover:text-foreground">
            <User className="h-4 w-4" strokeWidth={1.5} /> Account
          </Link>
        </div>
      </div>

      <CartPanel open={cartOpen} onClose={() => setCartOpen(false)} />
      <DrawerShell open={wishlistOpen} onClose={() => setWishlistOpen(false)} title="YOUR WISHLIST">
        <EmptyState label="Your wishlist is empty." />
      </DrawerShell>
    </>
  )
}
