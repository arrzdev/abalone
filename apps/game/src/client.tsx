import { StartClient } from "@tanstack/react-start/client"
import { StrictMode, startTransition } from "react"
import { hydrateRoot } from "react-dom/client"
import { rememberLanding } from "@/utils/landing-entry"

//Start's default client entry, ejected for one line: the tab's landing is read
//before the router starts, while the address is still the one the tab opened

rememberLanding()

startTransition(() => {
  hydrateRoot(
    document,
    <StrictMode>
      <StartClient />
    </StrictMode>,
  )
})
