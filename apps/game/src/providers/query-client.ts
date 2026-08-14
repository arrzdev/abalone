import { QueryClient } from "@tanstack/react-query"

//one client for the app's whole server surface, which today is the profile.
//`staleTime` is generous on purpose: the only thing that changes is the avatar,
//and only from this device, so refetching on every mount would be pure noise.
export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000,
      retry: 1,
    },
  },
})
