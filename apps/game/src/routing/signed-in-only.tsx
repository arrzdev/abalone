import { Navigate } from "@tanstack/react-router"
import type { ReactNode } from "react"
import { needsSignIn } from "@/routing/auth-guard"
import type { ReturnTo } from "@/routing/return-to"

//---- Signed-in only -----------------------------------------------
//the second half of the guard, and the half that actually runs on a cold load.
//
//`beforeLoad` covers navigation inside the app, where it is the better answer:
//the screen never mounts and nobody sees a frame of it. what it does NOT cover
//is arriving from outside — a reload, a pasted link, an icon on a home screen.
//there the router matches the route while answering the document request, on a
//worker with no `localStorage`, and hydrates that verdict rather than asking
//again. a guard that lives only in `beforeLoad` is therefore skipped by exactly
//the entry the token is hardest to see from.
//
//so the route says it twice: once where it is cheap, and once where it works.

type SignedInOnlyProps = {
  /** Where to send them back to once they have signed in. */
  returnTo: ReturnTo
  children: ReactNode
}

/** Renders its screen for a signed-in player, and the login screen otherwise. */
export function SignedInOnly({ returnTo, children }: SignedInOnlyProps) {
  if (needsSignIn())
    return <Navigate to="/login" search={{ redirect: returnTo }} replace />

  return children
}
