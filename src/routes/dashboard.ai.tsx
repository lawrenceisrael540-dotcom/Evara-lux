import { createFileRoute } from "@tanstack/react-router"
import { AIDashboard } from "../components/home/AIDashboard"
export const Route = createFileRoute("/dashboard/ai")({ component: AIDashboard })
