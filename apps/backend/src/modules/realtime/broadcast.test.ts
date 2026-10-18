import { afterEach, describe, expect, it, vi } from "vitest"
import { broadcast } from "@/modules/realtime/broadcast"

function socket(onSend: (frame: string) => void) {
  return { send: onSend } as unknown as WebSocket
}

function captureWarnings() {
  const lines: Record<string, unknown>[] = []
  vi.spyOn(console, "warn").mockImplementation((line: unknown) => {
    lines.push(JSON.parse(String(line)))
  })
  return lines
}

const gameUpdated = {
  event: "game-updated" as const,
  meta: { gameId: "g1", updatedAt: 1 },
}

describe("broadcast", () => {
  afterEach(() => vi.restoreAllMocks())

  it("sends the frame to every subscriber, and logs nothing when all land", async () => {
    const lines = captureWarnings()
    const received: string[] = []
    await broadcast(
      [socket((f) => received.push(f)), socket((f) => received.push(f))],
      gameUpdated,
      { channel: "user:a", request_id: "req-1" },
    )
    expect(received).toEqual([
      JSON.stringify(gameUpdated),
      JSON.stringify(gameUpdated),
    ])
    expect(lines).toHaveLength(0)
  })

  it("keeps sending past a dead socket, then logs the failures once with the context", async () => {
    const lines = captureWarnings()
    const received: string[] = []
    await broadcast(
      [
        socket(() => {
          throw new Error("socket closed")
        }),
        socket((f) => received.push(f)),
      ],
      gameUpdated,
      { channel: "user:a", request_id: "req-2" },
    )
    expect(received).toHaveLength(1)
    expect(lines).toHaveLength(1)
    expect(lines[0]).toMatchObject({
      level: "warn",
      message: "pubsub_send_failed",
      request_id: "req-2",
      channel: "user:a",
      event: "game-updated",
      game_id: "g1",
      failed: 1,
      subscribers: 2,
      error: { message: "socket closed" },
    })
  })
})
