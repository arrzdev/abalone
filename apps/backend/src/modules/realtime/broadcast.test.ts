import { afterEach, describe, expect, it, vi } from "vitest"
import { broadcast } from "@/modules/realtime/broadcast"

function socket(onSend: (frame: string) => void) {
  return { send: onSend } as unknown as WebSocket
}

//every line, whatever its level: a publish is one unit of work with one line
function captureLines() {
  const lines: Record<string, unknown>[] = []
  for (const method of ["log", "warn", "error"] as const) {
    vi.spyOn(console, method).mockImplementation((line: unknown) => {
      lines.push(JSON.parse(String(line)))
    })
  }
  return lines
}

const gameUpdated = {
  event: "game-updated" as const,
  meta: { gameId: "g1", updatedAt: 1 },
}

describe("broadcast", () => {
  afterEach(() => vi.restoreAllMocks())

  it("sends the frame to every subscriber, and writes one info summary line", async () => {
    const lines = captureLines()
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
    expect(lines).toHaveLength(1)
    expect(lines[0]).toMatchObject({
      level: "info",
      message: "pubsub.publish",
      outcome: "ok",
      request_id: "req-1",
      channel: "user:a",
      event: "game-updated",
      game_id: "g1",
      subscribers: 2,
      failed: 0,
    })
    expect(typeof lines[0]?.duration_ms).toBe("number")
    expect(lines[0]).not.toHaveProperty("error")
  })

  it("keeps sending past a dead socket, then puts the failures on the one summary line", async () => {
    const lines = captureLines()
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
      message: "pubsub.publish",
      outcome: "partial",
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
