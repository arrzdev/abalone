import { useNavigate } from "@tanstack/react-router"
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

/**
 * Renders its screen for a signed-in player, and sends the rest home to sign in.
 *
 * A guest never sees the screen, not even for a frame. These pages report on an
 * account, so without one they are an empty shape of a page — a hub saying there
 * are no games, a history saying nothing has been played — and that reads as an
 * answer about the account rather than as a locked door.
 *
 * Home is where they land, because home is the one screen that is for everybody,
 * and the overlay opens over it. Where they were going survives the trip: it is
 * held as the intent and run the moment they sign in.
 */
export function SignedInOnly({ returnTo, children }: SignedInOnlyProps) {
  const navigate = useNavigate()
  const { requireAuth } = useAuthPrompt()
  //subscribed to on purpose. the guard reads a store that notifies nobody, so
  //signing in through the overlay has to re-render this some other way, and the
  //session arriving is that moment.
  useAuth()

  const mustAsk = needsSignIn()

  useEffect(() => {
    if (!mustAsk) return
    //replaced rather than pushed: a guest who presses back should leave the way
    //they came in, not bounce off this screen a second time
    navigate({ to: "/", replace: true })
    //the overlay is mounted above the router, so the ask outlives the screen
    //that asked for it
    requireAuth({ redirect: returnTo })
  }, [mustAsk, navigate, requireAuth, returnTo])

  if (mustAsk) return null
  return children
}
