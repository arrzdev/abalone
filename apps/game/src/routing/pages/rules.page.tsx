import { Screen } from "@repo/nativ/components"
import { createFileRoute } from "@tanstack/react-router"

export const Route = createFileRoute("/rules")({
  component: RulesPage,
})

//---- Rules page ---------------------------------------------------
//SCAFFOLD — the illustrated rules land with the component port.

function RulesPage() {
  return (
    <Screen className="items-center justify-center bg-background text-foreground">
      <h1 className="text-2xl font-bold">Rules</h1>
    </Screen>
  )
}
