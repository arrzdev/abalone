import { StartClient } from "@tanstack/react-start/client"
import { StrictMode, startTransition } from "react"
import { hydrateRoot } from "react-dom/client"
import { env } from "@/env/registry"
import { rememberLanding } from "@/utils/landing-entry"
import { startWebAnalytics } from "@/utils/web-analytics"

//Start's default client entry, ejected for one line: the tab's landing is read
//before the router starts, while the address is still the one the tab opened.
//the analytics beacon starts here too, so it never sits in the server html

rememberLanding()
startWebAnalytics(env.VITE_CF_WEB_ANALYTICS_TOKEN, document, navigator)

startTransition(() => {
  hydrateRoot(
    document,
    <StrictMode>
      <StartClient />
    </StrictMode>,
  )
})
