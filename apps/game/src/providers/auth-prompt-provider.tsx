import { useNavigate } from "@tanstack/react-router"
import type { ReactNode } from "react"
import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
} from "react"
import { AuthSheet } from "@/components/auth-sheet"
import { useIsDesktop } from "@/hooks/use-is-desktop"
import { useAuth } from "@/providers/auth-provider"
import type { ReturnTo } from "@/routing/return-to"
import { returnToOptions } from "@/routing/return-to"

/** What the player was trying to do when they turned out to need an account. */
export type AuthIntent = {
  /** Where to land afterwards. Also what `?redirect=` carries on a desktop. */
  redirect?: ReturnTo
  /** Run instead of navigating — for the things that open rather than go. */
  onSuccess?: () => void
}

type AuthPromptValue = {
  /** Do it, asking for an account first if there isn't one yet. */
  requireAuth: (intent: AuthIntent) => void
}

const AuthPromptContext = createContext<AuthPromptValue>({
  requireAuth: () => {},
})

/**
 * "Sign in first, then carry on" — as one call, whatever shape it takes.
 *
 * The shape is the screen's, not the caller's. A desktop has room for the login
 * screen and a URL worth landing on, so it goes there. A phone gets the form in
 * a drawer over whatever it was already showing, because a page swap for two
 * fields costs the screen underneath and gives nothing back.
 *
 * Either way what they were doing survives the detour: the drawer runs the
 * intent on success and the login screen carries it in `?redirect=`, so nobody
 * signs in only to be dropped back where they started.
 */
export function AuthPromptProvider({ children }: { children: ReactNode }) {
  const navigate = useNavigate()
  const isDesktop = useIsDesktop()
  const { isAuthenticated } = useAuth()
  const [intent, setIntent] = useState<AuthIntent | null>(null)

  const run = useCallback(
    (pending: AuthIntent) => {
      if (pending.onSuccess) return pending.onSuccess()
      if (pending.redirect) navigate(returnToOptions(pending.redirect))
    },
    [navigate],
  )

  const requireAuth = useCallback(
    (pending: AuthIntent) => {
      if (isAuthenticated) return run(pending)
      if (isDesktop)
        return void navigate({
          to: "/login",
          search: { redirect: pending.redirect },
        })
      setIntent(pending)
    },
    [isAuthenticated, isDesktop, navigate, run],
  )

  const value = useMemo<AuthPromptValue>(
    () => ({ requireAuth }),
    [requireAuth],
  )

  return (
    <AuthPromptContext.Provider value={value}>
      {children}

      <AuthSheet
        open={intent !== null}
        destination={intent?.redirect ?? null}
        onClose={() => setIntent(null)}
        onAuthenticated={() => {
          //closed first, so the drawer plays its exit over the screen it opened
          //on rather than over whatever the intent brings up next
          setIntent(null)
          if (intent) run(intent)
        }}
      />
    </AuthPromptContext.Provider>
  )
}

export function useAuthPrompt(): AuthPromptValue {
  return useContext(AuthPromptContext)
}
