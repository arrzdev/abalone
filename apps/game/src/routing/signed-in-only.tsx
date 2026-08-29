import type { ReactNode } from "react"
import { useEffect } from "react"
import { useAuthPrompt } from "@/providers/auth-prompt-provider"
import { useAuth } from "@/providers/auth-provider"
import { needsSignIn } from "@/routing/auth-guard"
import type { ReturnTo } from "@/routing/return-to"

//---- Signed-in only -----------------------------------------------
//the guard that actually runs on a cold load.
//
//`beforeLoad` would cover navigation inside the app, where it is the cheaper
//answer: the screen never mounts and nobody sees a frame of it. what it does
//NOT cover is arriving from outside — a reload, a pasted link, an icon on a
//home screen. there the router matches the route while answering the document
//request, on a worker with no `localStorage`, and hydrates that verdict rather
//than asking again. a guard that lives only in `beforeLoad` is therefore
//skipped by exactly the entry the token is hardest to see from.
//
//so the ask lives here, where it works, and nowhere else. it used to be said
//twice, and the `beforeLoad` half had to name a screen to send a desktop to.
//there is no such screen now: signing in is an overlay over whatever you were
//looking at, which is a thing only a mounted component can open.

type SignedInOnlyProps = {
  /** Where to send them back to once they have signed in. */
  returnTo: ReturnTo
  children: ReactNode
}

/** Renders its screen for a signed-in player, and asks the rest to sign in. */
export function SignedInOnly({ returnTo, children }: SignedInOnlyProps) {
  const { requireAuth } = useAuthPrompt()
  //subscribed to on purpose. the guard reads a store that notifies nobody, so
  //signing in through the overlay has to re-render this some other way, and the
  //session arriving is that moment.
  useAuth()

  const mustAsk = needsSignIn()

  useEffect(() => {
    if (!mustAsk) return
    requireAuth({ redirect: returnTo })
  }, [mustAsk, requireAuth, returnTo])

  return children
}
