import { createFileRoute } from "@tanstack/react-router"
import { LegalCenter } from "../components/legal/LegalCenter"
export const Route = createFileRoute("/legal/terms")({ component: LegalCenter })
