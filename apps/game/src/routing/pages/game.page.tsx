import { Screen } from "@repo/nativ/components"
import { createFileRoute } from "@tanstack/react-router"

export const Route = createFileRoute("/game")({
  component: GamePage,
})

//---- Game page ----------------------------------------------------
//SCAFFOLD — the board, the panel and the opponent land with the component port.

function GamePage() {
  return (
    <Screen className="items-center justify-center bg-background text-foreground">
      <h1 className="text-2xl font-bold">Game</h1>
    </Screen>
  )
}
