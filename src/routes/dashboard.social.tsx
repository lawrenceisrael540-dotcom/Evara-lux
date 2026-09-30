import { createFileRoute } from "@tanstack/react-router"
import { SocialDashboard } from "../components/home/SocialDashboard"
export const Route = createFileRoute("/dashboard/social")({ component: SocialDashboard })
