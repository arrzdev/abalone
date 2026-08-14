import { useMutation, useQueryClient } from "@tanstack/react-query"
import { useNavigate } from "@tanstack/react-router"
import { signOut } from "@/data/auth/mutations"

/**
 * Signing out, from wherever it is offered.
 *
 * The cache is cleared whatever the server said: this device is signed out
 * either way, and anything left in it belongs to the last account. Home is where
 * it lands, because half the screens behind it are about being signed in.
 */
export function useSignOut() {
  const queryClient = useQueryClient()
  const navigate = useNavigate()

  return useMutation({
    mutationFn: signOut,
    onSettled: () => {
      queryClient.clear()
      navigate({ to: "/" })
    },
  })
}
