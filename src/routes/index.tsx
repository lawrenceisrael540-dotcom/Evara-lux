import { createFileRoute } from "@tanstack/react-router"
import { Storefront } from "../components/home/Storefront"
import { TrustStrip } from "../components/home/TrustStrip"

export const Route = createFileRoute("/")({
  component: HomePage,
})

function HomePage() {
  return <>
    <Storefront />
    <TrustStrip />
  </>
}
