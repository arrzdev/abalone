import { describe, expect, it } from "vitest"
import { publishToUsers, userChannel } from "@/modules/realtime/channel"
import type { PubSub } from "@/modules/realtime/pubsub.do"

//---- a stand-in for a durable object namespace ----------------

/**
 * What a durable object rpc call actually hands back.
 *
 * Not a promise: rpc supports pipelining (`stub.a().b()`), so the return value
 * is a CALLABLE proxy that also happens to be awaitable. `typeof` it is
 * "function", which is the whole reason this fake is worth having — a plain
 * promise here would let a fan-out that never awaits its calls pass the test
 * written to catch exactly that.
 */
function newRpcCall(settled: Promise<void>) {
  const call = () => settled
  return Object.assign(call, {
    // biome-ignore lint/suspicious/noThenProperty: mimicking the rpc proxy is the point of the fake
    then: settled.then.bind(settled),
    catch: settled.catch.bind(settled),
    finally: settled.finally.bind(settled),
  })
}

type Recorded = { names: string[]; delivered: string[] }

function newNamespace(
  recorded: Recorded,
  publish: (channel: string) => Promise<void>,
) {
  return {
    idFromName: (name: string) => {
      recorded.names.push(name)
      return name as unknown as DurableObjectId
    },
    get: (id: DurableObjectId) => ({
      publish: () => newRpcCall(publish(String(id))),
    }),
  } as unknown as DurableObjectNamespace<PubSub>
}

function landsImmediately(recorded: Recorded) {
  return async (channel: string) => {
    recorded.delivered.push(channel)
  }
}

//---- tests ----------------

describe("userChannel", () => {
  it("names a channel after the player", () => {
    expect(userChannel("abc")).toBe("user:abc")
  })
})

describe("publishToUsers", () => {
  it("tells every named player", async () => {
    const recorded: Recorded = { names: [], delivered: [] }

    await publishToUsers(
      newNamespace(recorded, landsImmediately(recorded)),
      ["black", "white"],
      { event: "games-changed" },
    )

    expect(recorded.names).toEqual(["user:black", "user:white"])
    expect(recorded.delivered).toEqual(["user:black", "user:white"])
  })

  it("tells a player once when both seats are theirs", async () => {
    const recorded: Recorded = { names: [], delivered: [] }

    await publishToUsers(
      newNamespace(recorded, landsImmediately(recorded)),
      ["solo", "solo"],
      { event: "invites-changed" },
    )

    expect(recorded.names).toEqual(["user:solo"])
    expect(recorded.delivered).toEqual(["user:solo"])
  })

  //the regression this file exists for. a call that is fired and not awaited
  //resolves the fan-out immediately, `waitUntil` sees finished work, and the
  //runtime tears the request down with the call still in flight — every beacon
  //silently lost, and nothing failing anywhere to say so.
  it("does not resolve until the call has actually landed", async () => {
    const recorded: Recorded = { names: [], delivered: [] }
    let land = () => {}
    const held = new Promise<void>((resolve) => {
      land = () => {
        recorded.delivered.push("user:black")
        resolve()
      }
    })

    let finished = false
    const publishing = publishToUsers(
      newNamespace(recorded, () => held),
      ["black"],
      { event: "invites-changed" },
    ).then(() => {
      finished = true
    })

    //give every microtask that could run a chance to. a fan-out that is not
    //waiting for its calls has resolved by now.
    await new Promise((resolve) => setTimeout(resolve, 0))
    expect(finished).toBe(false)
    expect(recorded.delivered).toEqual([])

    land()
    await publishing
    expect(finished).toBe(true)
    expect(recorded.delivered).toEqual(["user:black"])
  })

  it("carries on when one channel fails", async () => {
    const recorded: Recorded = { names: [], delivered: [] }
    const namespace = newNamespace(recorded, async (channel) => {
      if (channel === "user:black") throw new Error("object unreachable")
      recorded.delivered.push(channel)
    })

    await expect(
      publishToUsers(namespace, ["black", "white"], {
        event: "games-changed",
      }),
    ).resolves.toBeUndefined()
    expect(recorded.delivered).toEqual(["user:white"])
  })
})
