import { Screen } from "@repo/nativ/components"
import { createFileRoute } from "@tanstack/react-router"
import { useEffect, useState } from "react"
import { BotClient } from "@/ai/bot-client"
import { createGameState, toSearchState } from "@/engine/game-state"
import { formatMoveAlgebraic } from "@/engine/notation"

export const Route = createFileRoute("/game")({
  component: GamePage,
})

//---- Game page ------------------------------------------------------
//SCAFFOLD — the board, the panel and the controls land with the component port.
//What is here is the phase-2 gate: a real bot, on a real worker, answering
//from the real engine. If the worker does not survive nativ's Vite pipeline,
//this page says so rather than the board finding out in phase 5.

function GamePage() {
  const [reply, setReply] = useState("thinking…")

  useEffect(() => {
    const bot = new BotClient()
    let live = true

    async function openMove() {
      await bot.connect(4)
      const move = await bot.requestMove(toSearchState(createGameState()))
      if (!live) return
      setReply(
        move.selection && move.move
          ? formatMoveAlgebraic(move.selection, move.move)
          : "no move",
      )
    }

    openMove().catch((error) => {
      if (live) setReply(`bot failed: ${error}`)
    })

    return () => {
      live = false
      bot.disconnect()
    }
  }, [])

  return (
    <Screen className="items-center justify-center gap-2 bg-background text-foreground">
      <h1 className="font-bold text-2xl">Game</h1>
      <p className="text-muted text-sm">
        Bot's opening reply: <span className="text-primary">{reply}</span>
      </p>
    </Screen>
  )
}
