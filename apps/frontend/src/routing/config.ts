import { index, rootRoute, route } from "@repo/nativ/routes"

//nativ owns the root route (stamped __root.gen.tsx) — declare only the children.
//routing files follow the repo's {domain}.{role} convention: `*.page.tsx` for
//pages, `*.layout.tsx` for nested layouts (see core/repository-layout).
export const routes = rootRoute([
  index("pages/home.page.tsx"),
  route("/settings", "pages/settings.page.tsx"),
])

export default routes
