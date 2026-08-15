import { useMutation, useQueryClient } from "@tanstack/react-query"
import { useNavigate } from "@tanstack/react-router"
import { signOut } from "@/data/auth/mutations"
import { persister } from "@/providers/query-persister"

/**
 * Signing out, from wherever it is offered.
 *
 * The cache is cleared whatever the server said: this device is signed out
 * either way, and anything left in it belongs to the last account. Home is where
 * it lands, because half the screens behind it are about being signed in.
 *
 * The saved copy goes with it, and by hand rather than by waiting for the empty
 * cache to be written out — that write is throttled, and "your games are off
 * this device" should not be true a second later than the press.
 */
export function useSignOut() {
  const queryClient = useQueryClient()
  const navigate = useNavigate()

  return useMutation({
    mutationFn: signOut,
    onSettled: async () => {
      queryClient.clear()
      await persister.removeClient()
      navigate({ to: "/" })
    },
  })
}
