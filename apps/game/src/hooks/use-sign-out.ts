import { useMutation } from "@tanstack/react-query"
import { useNavigate } from "@tanstack/react-router"
import { signOut } from "@/data/auth/mutations"

/**
 * Signing out, from wherever it is offered.
 *
 * What the device holds is dropped by `signOut` itself, whatever the server
 * said (`data/auth/session-end.ts`), so all that is left here is where to go.
 * Home, because half the screens behind it are about being signed in.
 */
export function useSignOut() {
  const navigate = useNavigate()

  return useMutation({
    mutationFn: signOut,
    onSettled: () => {
      navigate({ to: "/" })
    },
  })
}
