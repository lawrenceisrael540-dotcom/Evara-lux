import { useState } from 'react'

export function Newsletter() {
  const [email, setEmail] = useState('')
  const [submitted, setSubmitted] = useState(false)

  return (
    <section className="border-t border-border bg-background py-28">
      <div className="mx-auto max-w-xl px-6 text-center md:px-10">
        <h2 className="font-display text-3xl tracking-tight text-foreground md:text-4xl">ENTER THE EVARA WORLD.</h2>
        <p className="mt-5 text-sm leading-relaxed text-muted-foreground md:text-base">
          Receive new collections, private discoveries and stories worth knowing.
        </p>

        {submitted ? (
          <p className="mt-10 font-display text-lg text-accent">You're on the list.</p>
        ) : (
          <form
            onSubmit={(e) => {
              e.preventDefault()
              setSubmitted(true)
            }}
            className="mt-10 flex flex-col gap-3 sm:flex-row"
          >
            <input
              required
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="Your email address"
              className="w-full border border-border bg-transparent px-5 py-4 text-sm text-foreground placeholder:text-muted-foreground focus:border-foreground focus:outline-none"
            />
            <button
              type="submit"
              className="shrink-0 border border-foreground bg-foreground px-8 py-4 text-[12px] font-semibold tracking-[0.18em] text-primary-foreground transition-colors duration-300 hover:bg-transparent hover:text-foreground"
            >
              JOIN EVARA
            </button>
          </form>
        )}
      </div>
    </section>
  )
}
