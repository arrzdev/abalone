import { newEndpoint } from "@repo/shared/http"
import { healthRoutes } from "@/http/routes/health.routes"
import { notesRoutes } from "@/http/routes/notes.routes"

//composition root, not a barrel: it mounts domains under the version prefix
//rather than re-exporting them. one `.route()` line per domain.
export const v1Routes = newEndpoint()
  .route("/health", healthRoutes)
  .route("/notes", notesRoutes)
