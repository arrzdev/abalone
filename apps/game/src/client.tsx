//first: zod reads its config when a schema is built (utils/zod-jitless)
import "@/utils/zod-jitless"
import tryCatch from "@repo/shared/try-catch"
import { StartClient } from "@tanstack/react-start/client"
import { StrictMode, startTransition } from "react"
import { hydrateRoot } from "react-dom/client"
import { env } from "@/env/registry"
import { i18nReady } from "@/i18n"
import { clientLocaleRedirect } from "@/i18n/saved-language"
import { rememberLanding } from "@/utils/landing-entry"
import { startWebAnalytics } from "@/utils/web-analytics"

//Start's default client entry, ejected for one line: the tab's landing is read
//before the router starts, while the address is still the one the tab opened.
//the analytics beacon starts here too, so it never sits in the server html,
//and hydration waits for the page's language

//an unprefixed address goes to the saved or browser language, as the Worker
//would have sent it: the service worker can answer a navigation without it
const movedTo = clientLocaleRedirect()

if (movedTo) {
  window.location.replace(movedTo)
} else {
  rememberLanding()
  startWebAnalytics(env.VITE_CF_WEB_ANALYTICS_TOKEN, document, navigator)

  //the page's language is fetched, not bundled: hydrating before it is in
  //would render keys where the server rendered words. it is a precached file,
  //so offline waits no longer than online. if it cannot be had the page
  //still hydrates: a game in the wrong words beats no game
  await tryCatch(() => i18nReady)

  startTransition(() => {
    hydrateRoot(
      document,
      <StrictMode>
        <StartClient />
      </StrictMode>,
    )
  })
}
