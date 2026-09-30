import { createFileRoute } from "@tanstack/react-router"
import { SecurityCenter } from "../components/security/SecurityCenter"
export const Route = createFileRoute("/security")({ component: SecurityCenter })
