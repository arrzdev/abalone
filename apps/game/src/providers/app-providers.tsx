import { QueryClientProvider } from "@tanstack/react-query"
import type { ReactNode } from "react"
import { useSoundPreferences } from "@/hooks/use-app-preferences"
import { AuthPromptProvider } from "@/providers/auth-prompt-provider"
import { AuthProvider } from "@/providers/auth-provider"
import { queryClient } from "@/providers/query-client"
//side-effect: initialises i18next before any component asks for a string
import "@/i18n"

/**
 * App-wide provider tree mounted by the nativ shell around the router outlet.
 *
 * Auth sits inside the query client because the profile query is gated on it,
 * and both sit above the outlet so navigating between screens never remounts
 * either one. That is what makes tab switches instant.
 *
 * The auth prompt is here rather than in the shell because it holds a drawer
 * that has to outlive the screen that opened it — it navigates on success, and
 * a drawer unmounted by its own navigation never plays its exit.
 */
export default function AppProviders({
  children,
}: {
  children: ReactNode
}) {
  //the sound module holds its own volume so a move can be played from anywhere
  //without threading it through; this is what puts the saved value there on
  //load. It belongs to the app rather than to any screen — the board used to do
  //it, which made "did the game page mount yet" the thing the volume depended on
  useSoundPreferences()

  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <AuthPromptProvider>{children}</AuthPromptProvider>
      </AuthProvider>
    </QueryClientProvider>
  )
}
