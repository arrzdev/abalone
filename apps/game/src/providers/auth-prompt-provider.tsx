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
import { useAuth } from "@/providers/auth-provider"
import type { ReturnTo } from "@/routing/return-to"
import { returnToOptions } from "@/routing/return-to"

/** What the player was trying to do when they turned out to need an account. */
export type AuthIntent = {
  /** Where to land afterwards, once the overlay closes. */
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
 * "Sign in first, then carry on" — as one call, from anywhere.
 *
 * Signing in is never a place you go. It is an overlay over the screen that
 * asked, because it is always something started for a reason, and a page swap
 * for two fields costs the screen underneath and gives nothing back. Above `lg`
 * that overlay is a dialog and below it a drawer, which is `Sheet`'s own split,
 * not a decision taken here.
 *
 * What they were doing survives the detour: the intent is held while the form is
 * open and run the moment it succeeds, so nobody signs in only to be dropped
 * back where they started.
 */
export function AuthPromptProvider({ children }: { children: ReactNode }) {
  const navigate = useNavigate()
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
      setIntent(pending)
    },
    [isAuthenticated, run],
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
        onClose={() => setIntent(null)}
        onAuthenticated={() => {
          //closed first, so the overlay plays its exit over the screen it
          //opened on rather than over whatever the intent brings up next
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
