import { newEndpoint } from "@repo/shared/http"
import { authHandlerRoutes } from "@/http/routes/auth.routes"
import { devAvatarRoutes } from "@/http/routes/avatars.routes"
import { gameRoutes } from "@/http/routes/game.routes"
import { inviteRoutes } from "@/http/routes/invite.routes"
import { profileRoutes } from "@/http/routes/profile.routes"
import { realtimeRoutes } from "@/http/routes/realtime.routes"

//composition root, not a barrel: it mounts domains under the version prefix
//rather than re-exporting them. one `.route()` line per domain.
export const v1Routes = newEndpoint()
  .route("/auth", authHandlerRoutes)
  .route("/profile", profileRoutes)
  .route("/invites", inviteRoutes)
  .route("/games", gameRoutes)
  .route("/realtime", realtimeRoutes)
  //inert in production — see the file
  .route("/avatars", devAvatarRoutes)
