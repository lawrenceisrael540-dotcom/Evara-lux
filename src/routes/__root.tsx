import {
  HeadContent,
  Outlet,
  Scripts,
  createRootRoute,
} from "@tanstack/react-router"
import ConvexAuthProvider from "../components/convex-client-provider"
import { Navbar } from "../components/home/Navbar"
import { Footer } from "../components/home/Footer"
import { ErrorBoundary } from "../components/error-boundary"
import { NotFound } from "../components/not-found"
import "../styles.css"

export const Route = createRootRoute({
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1" },
      { title: "EVARA·LUX — More Than What You Buy." },
      { name: "description", content: "EVARA·LUX is a connected storefront, social, intelligence and membership experience." },
    ],
  }),
  errorComponent: ErrorBoundary,
  notFoundComponent: NotFound,
  component: RootLayout,
})

function RootLayout() {
  return (
    <html lang="en">
      <head><HeadContent /></head>
      <body>
        <ConvexAuthProvider>
          <Navbar />
          <main className="min-h-screen pt-[76px]"><Outlet /></main>
          <Footer />
        </ConvexAuthProvider>
        <Scripts />
      </body>
    </html>
  )
}
