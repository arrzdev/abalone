import { describe, expect, it } from "vitest"

//the wide event: facts a service or facade adds during a unit of work end up on
//that unit's single line, with no logger passed between functions
const fresh = async () => {
  const {
    addLogFields,
    addTiming,
    currentRequestId,
    logEventFields,
    withLogContext,
    withLogEvent,
  } = await import("@repo/shared/log-context")
  return {
    addLogFields,
    addTiming,
    currentRequestId,
    logEventFields,
    withLogContext,
    withLogEvent,
  }
}

describe("withLogEvent", () => {
  it("collects addLogFields from any depth, across awaits", async () => {
    const { addLogFields, logEventFields, withLogEvent } = await fresh()
    const service = async () => {
      await Promise.resolve()
      addLogFields({ plan: "pro" })
    }
    const fields = await withLogEvent(
      { request_id: "req-1" },
      async () => {
        addLogFields({ cache_hit: true })
        await service()
        return logEventFields()
      },
    )
    expect(fields).toEqual({ cache_hit: true, plan: "pro" })
  })

  it("puts its context on every line like withLogContext", async () => {
    const { currentRequestId, withLogEvent } = await fresh()
    const id = await withLogEvent({ request_id: "req-2" }, async () => {
      await Promise.resolve()
      return currentRequestId()
    })
    expect(id).toBe("req-2")
  })

  it("adds up timings per name under timings", async () => {
    const { addTiming, logEventFields, withLogEvent } = await fresh()
    const fields = await withLogEvent({}, async () => {
      addTiming("d1", 5)
      addTiming("stripe", 230)
      addTiming("d1", 7)
      return logEventFields()
    })
    expect(fields).toEqual({ timings: { d1: 12, stripe: 230 } })
  })

  it("leaves timings out when none were added", async () => {
    const { logEventFields, withLogEvent } = await fresh()
    const fields = await withLogEvent({}, async () => logEventFields())
    expect(fields).not.toHaveProperty("timings")
  })

  it("shares the event with a nested withLogContext", async () => {
    const { addLogFields, logEventFields, withLogContext, withLogEvent } =
      await fresh()
    const fields = await withLogEvent(
      { request_id: "req-3" },
      async () => {
        await withLogContext({ channel: "user:a" }, async () => {
          addLogFields({ delivered: 2 })
        })
        return logEventFields()
      },
    )
    expect(fields).toEqual({ delivered: 2 })
  })

  it("gives each unit of work its own event, even when they overlap", async () => {
    const { addLogFields, logEventFields, withLogEvent } = await fresh()
    const unit = (name: string, wait: number) =>
      withLogEvent({ request_id: name }, async () => {
        addLogFields({ [name]: true })
        await new Promise((resolve) => setTimeout(resolve, wait))
        return logEventFields()
      })
    const [first, second] = await Promise.all([
      unit("a", 10),
      unit("b", 0),
    ])
    expect(first).toEqual({ a: true })
    expect(second).toEqual({ b: true })
  })

  it("starts a fresh event when nested inside another one", async () => {
    const { addLogFields, logEventFields, withLogEvent } = await fresh()
    const [outer, inner] = await withLogEvent({}, async () => {
      addLogFields({ outer: true })
      const nested = await withLogEvent({}, async () => {
        addLogFields({ inner: true })
        return logEventFields()
      })
      return [logEventFields(), nested]
    })
    expect(outer).toEqual({ outer: true })
    expect(inner).toEqual({ inner: true })
  })

  it("ignores addLogFields and addTiming outside a unit of work", async () => {
    const { addLogFields, addTiming, logEventFields } = await fresh()
    expect(() => addLogFields({ lost: true })).not.toThrow()
    expect(() => addTiming("d1", 3)).not.toThrow()
    expect(logEventFields()).toEqual({})
  })
})
