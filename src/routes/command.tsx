import { createFileRoute } from "@tanstack/react-router"
import { EcosystemHub } from "../components/EcosystemHub"
export const Route = createFileRoute("/command")({ component: EcosystemHub })
