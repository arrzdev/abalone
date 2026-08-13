import { index, rootRoute, route } from "@repo/nativ/routes"

//nativ owns the root route (stamped __root.gen.tsx) — declare only the children.
//routing files follow the repo's {domain}.{role} convention: `*.page.tsx` for
//pages (see core-repository-layout).
//
//three screens, three routes. they used to be one `useState` in App.jsx, which
//meant the back gesture left the game entirely and a shared link only ever
//opened the menu.
export const routes = rootRoute([
  index("pages/home.page.tsx"),
  route("/rules", "pages/rules.page.tsx"),
  route("/game", "pages/game.page.tsx"),
])

export default routes
