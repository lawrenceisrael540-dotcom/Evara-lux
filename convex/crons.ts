import { cronJobs } from "convex/server"
import { internal } from "./_generated/api"

const crons = cronJobs()

crons.interval(
  "evara feed learning",
  { hours: 6 },
  internal.social.evolveAlgorithm,
  {},
)

crons.interval(
  "evara recommendation refresh",
  { hours: 6 },
  internal.recommendations.refreshAll,
  {},
)

crons.interval(
  "evara cart recovery",
  { hours: 1 },
  internal.cartRecovery.recoverStale,
  {},
)

export default crons
