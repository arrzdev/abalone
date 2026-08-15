import { Navigate } from "@tanstack/react-router"
import type { ReactNode } from "react"
import { useEffect } from "react"
import { useIsDesktop } from "@/hooks/use-is-desktop"
import { useAuthPrompt } from "@/providers/auth-prompt-provider"
import { useAuth } from "@/providers/auth-provider"
import { signInPrompt } from "@/routing/auth-guard"
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
//
//which shape the ask takes is `signInPrompt`'s call, not this file's, so that a
//guard and a tap ask the same way: login screen on a desktop, drawer on a phone.

type SignedInOnlyProps = {
  /** Where to send them back to once they have signed in. */
  returnTo: ReturnTo
  children: ReactNode
}

/** Renders its screen for a signed-in player, and asks the rest to sign in. */
export function SignedInOnly({ returnTo, children }: SignedInOnlyProps) {
  const isDesktop = useIsDesktop()
  const { requireAuth } = useAuthPrompt()
  //subscribed to on purpose. the guard reads a store that notifies nobody, so
  //signing in through the drawer has to re-render this some other way, and the
  //session arriving is that moment.
  useAuth()

  const prompt = signInPrompt(isDesktop)

  useEffect(() => {
    if (prompt !== "drawer") return
    requireAuth({ redirect: returnTo })
  }, [prompt, requireAuth, returnTo])

  //the desktop half is a navigation rather than a prompt, so it is answered
  //here instead of through the provider: an effect would cost a render of a
  //screen the guest cannot use, which is the thing this gate exists to prevent
  if (prompt === "login-screen")
    return <Navigate to="/login" search={{ redirect: returnTo }} replace />

  return children
}
