import { newEndpoint } from "@repo/shared/http"
import { helloRoutes } from "@/http/routes/hello.routes"

//composition root, not a barrel: it mounts domains under the version prefix
//rather than re-exporting them. one `.route()` line per domain.
export const v1Routes = newEndpoint().route("/hello", helloRoutes)
