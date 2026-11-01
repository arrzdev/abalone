import { env } from "cloudflare:workers"
import { eq } from "drizzle-orm"
import { describe, expect, it } from "vitest"
import { getDb } from "@/database/client"
import { gameEvents } from "@/database/schema"
import type { GameEvent } from "@/services/game-event.service"
import { GameEventService } from "@/services/game-event.service"
import { failingD1 } from "@/test-support/failing-bindings"

function startEvent(gameRef: string): GameEvent {
  return {
    gameRef,
    kind: "start",
    mode: "ai",
    botLevel: 3,
    result: null,
    moveCount: null,
    guided: true,
    entry: "home",
    appVersion: "test-build",
  }
}

describe("game event service", () => {
  const db = getDb(env.DB)

  it("stores the event under its own id, stamped with the server clock", async () => {
    const before = Date.now()
    await new GameEventService(db).record(startEvent("ref-recorded"))

    const rows = await db
      .select()
      .from(gameEvents)
      .where(eq(gameEvents.gameRef, "ref-recorded"))
    expect(rows).toHaveLength(1)

    const [row] = rows
    expect(row).toMatchObject({
      gameRef: "ref-recorded",
      kind: "start",
      mode: "ai",
      botLevel: 3,
      guided: true,
      entry: "home",
      appVersion: "test-build",
    })
    expect(row?.id).not.toBe("ref-recorded")
    expect(row?.createdAt.getTime()).toBeGreaterThanOrEqual(before - 1000)
  })

  it("keeps a start and its finish as two rows on one ref", async () => {
    const service = new GameEventService(db)
    await service.record(startEvent("ref-paired"))
    await service.record({
      ...startEvent("ref-paired"),
      kind: "finish",
      result: "win",
      moveCount: 42,
      guided: false,
      entry: null,
    })

    const rows = await db
      .select()
      .from(gameEvents)
      .where(eq(gameEvents.gameRef, "ref-paired"))
    expect(rows.map((row) => row.kind).sort()).toEqual(["finish", "start"])
  })

  it("answers internal_server_error when D1 refuses the write", async () => {
    const service = new GameEventService(getDb(failingD1()))

    await expect(
      service.record(startEvent("ref-lost")),
    ).rejects.toMatchObject({ errorCode: "internal_server_error" })
  })
})
