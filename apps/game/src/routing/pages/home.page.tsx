import { Screen } from "@repo/nativ/components"
import { createFileRoute } from "@tanstack/react-router"
import { Logo } from "@/components/logo"

export const Route = createFileRoute("/")({
  component: HomePage,
})

//---- Home page ----------------------------------------------------
//SCAFFOLD — the shell's index route. The real menu (online/offline, the
//language switcher, the rules link) lands with the component port.

function HomePage() {
  return (
    <Screen className="items-center justify-center gap-y-4 bg-background text-foreground">
      <Logo className="w-24" />
      <h1 className="text-3xl font-extrabold tracking-tight">Abalone</h1>
    </Screen>
  )
}
