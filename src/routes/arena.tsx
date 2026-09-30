import { createFileRoute } from "@tanstack/react-router"
import { ArcanaArena } from "../components/game/ArcanaArena"
export const Route = createFileRoute("/arena")({ component: ArcanaArena })
