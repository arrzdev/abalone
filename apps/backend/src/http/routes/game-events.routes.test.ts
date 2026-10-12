import { env } from "cloudflare:workers"
import { beforeAll, beforeEach, describe, expect, it } from "vitest"
import worker from "@/entrypoint"
import { envRegistry } from "@/env/registry"
import { resetRateLimitBuckets } from "@/http/middlewares/rate-limit"
import type { Game } from "@/services/game.service"
import type { Invite } from "@/services/invite.service"
import { newExecutionContext } from "@/test-support/execution-context"

type Envelope<Data> = {
  status: string
  error_code?: string
  data?: Data
}

type GameEventRow = {
  id: string
  game_ref: string
  kind: string
  mode: string
  bot_level: number | null
  result: string | null
  move_count: number | null
  //sqlite has no boolean: 1 or 0
  guided: number
  app_version: string
  created_at: number
}

//the whole row, and nothing else. a column added here is a decision about what
//we keep on people, so it has to be made in this list on purpose.
const ALLOWED_COLUMNS = [
  "app_version",
  "bot_level",
  "created_at",
  "game_ref",
  "guided",
  "id",
  "kind",
  "mode",
  "move_count",
  "result",
]

const CLIENT_IP = "203.0.113.77"

describe("game event routes", () => {
  beforeAll(() => {
    envRegistry.setEnv(env as unknown as Record<string, unknown>)
  })

  beforeEach(async () => {
    resetRateLimitBuckets()
    await env.DB.prepare("delete from game_events").run()
  })

  //---- talking to the worker ----------------

  /**
   * Posts an event the way the game does: `sendBeacon` with a string body,
   * which the browser labels `text/plain`, from the game's own origin.
   */
  async function post(
    body: unknown,
    options: {
      contentType?: string
      bypass?: boolean
      headers?: Record<string, string>
    } = {},
  ) {
    const context = newExecutionContext()
    const headers: Record<string, string> = {
      origin: "http://example.com",
      "content-type": options.contentType ?? "text/plain;charset=UTF-8",
      "cf-connecting-ip": CLIENT_IP,
      ...options.headers,
    }
    if (options.bypass !== false) headers["x-test-bypass"] = "true"

    const response = await worker.fetch(
      new Request("http://example.com/api/v1/events/game", {
        method: "POST",
        headers,
        body: typeof body === "string" ? body : JSON.stringify(body),
      }),
      env as never,
      context,
    )
    await context.settled()
    return response
  }

  async function rows(): Promise<GameEventRow[]> {
    const { results } = await env.DB.prepare(
      "select * from game_events order by created_at, kind desc",
    ).all<GameEventRow>()
    return results
  }

  const gameRef = () => crypto.randomUUID()

  const start = (ref: string) => ({
    gameRef: ref,
    kind: "start",
    mode: "ai",
    botLevel: 3,
    appVersion: "abc1234",
  })

  //---- the client's two events ----------------

  it("stores a game started against a bot and answers 204", async () => {
    const ref = gameRef()

    const response = await post(start(ref))

    expect(response.status).toBe(204)
    const [row, ...rest] = await rows()
    expect(rest).toHaveLength(0)
    expect(row).toMatchObject({
      game_ref: ref,
      kind: "start",
      mode: "ai",
      bot_level: 3,
      result: null,
      move_count: null,
      app_version: "abc1234",
    })
    expect(row.id).not.toBe(ref)
    expect(Math.abs(row.created_at - Date.now())).toBeLessThan(60_000)
  })

  it("stores a finished pass and play game with its winner and length", async () => {
    const ref = gameRef()

    const response = await post(
      {
        gameRef: ref,
        kind: "finish",
        mode: "local",
        result: "white",
        moveCount: 41,
        appVersion: "abc1234",
      },
      { contentType: "application/json" },
    )

    expect(response.status).toBe(204)
    expect(await rows()).toEqual([
      expect.objectContaining({
        game_ref: ref,
        kind: "finish",
        mode: "local",
        bot_level: null,
        result: "white",
        move_count: 41,
      }),
    ])
  })

  it("pairs a start and its finish by the game's ref", async () => {
    const ref = gameRef()

    await post(start(ref))
    await post({
      gameRef: ref,
      kind: "finish",
      mode: "ai",
      botLevel: 3,
      result: "loss",
      moveCount: 2,
      appVersion: "abc1234",
    })

    const stored = await rows()
    expect(stored.map((row) => [row.kind, row.game_ref])).toEqual([
      ["start", ref],
      ["finish", ref],
    ])
  })

  //---- whether the first-game guide was showing ----------------

  it.each([
    ["ai", 3],
    ["local", undefined],
  ] as const)(
    "stores a %s game that started with the guide showing as guided",
    async (mode, botLevel) => {
      const ref = gameRef()

      const response = await post({
        ...start(ref),
        mode,
        botLevel,
        guided: true,
      })

      expect(response.status).toBe(204)
      expect(await rows()).toEqual([
        expect.objectContaining({
          game_ref: ref,
          kind: "start",
          guided: 1,
        }),
      ])
    },
  )

  it("stores a game that started without the guide as not guided", async () => {
    await post({ ...start(gameRef()), guided: false })

    const [row] = await rows()
    expect(row.guided).toBe(0)
  })

  //a build from before the flag is still cached on some phones
  it("stores a start that does not say as not guided", async () => {
    const response = await post(start(gameRef()))

    expect(response.status).toBe(204)
    const [row] = await rows()
    expect(row.guided).toBe(0)
  })

  //the start says it, and its finish pairs up with it by the game's ref
  it("stores every finish as not guided", async () => {
    await post({
      gameRef: gameRef(),
      kind: "finish",
      mode: "local",
      result: "black",
      moveCount: 12,
      appVersion: "abc1234",
    })

    const [row] = await rows()
    expect(row.guided).toBe(0)
  })

  //---- our own checks ----------------

  const HEADLESS_CHROME =
    "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) HeadlessChrome/140.0.0.0 Safari/537.36"
  const DESKTOP_CHROME =
    "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Safari/537.36"

  async function playToTheEnd(options: {
    automated?: boolean
    userAgent: string
  }) {
    const ref = gameRef()
    const automated =
      options.automated === undefined
        ? {}
        : { automated: options.automated }
    const headers = { "user-agent": options.userAgent }

    const started = await post(
      { ...start(ref), ...automated },
      { headers },
    )
    const finished = await post(
      {
        ...start(ref),
        ...automated,
        kind: "finish",
        result: "win",
        moveCount: 9,
      },
      { headers },
    )
    return [started.status, finished.status]
  }

  it("counts a player's game in a normal browser once started and once finished", async () => {
    const statuses = await playToTheEnd({ userAgent: DESKTOP_CHROME })

    expect(statuses).toEqual([204, 204])
    expect((await rows()).map((row) => row.kind)).toEqual([
      "start",
      "finish",
    ])
  })

  it("counts a game whose browser says it is not automated", async () => {
    await playToTheEnd({ automated: false, userAgent: DESKTOP_CHROME })

    expect(await rows()).toHaveLength(2)
  })

  it("answers a test-driven browser like a player but keeps none of its game", async () => {
    const statuses = await playToTheEnd({
      automated: true,
      userAgent: DESKTOP_CHROME,
    })

    expect(statuses).toEqual([204, 204])
    expect(await rows()).toHaveLength(0)
  })

  //an old build does not say `automated`, and emulation can hide it
  it("keeps none of a headless browser's game", async () => {
    const statuses = await playToTheEnd({ userAgent: HEADLESS_CHROME })

    expect(statuses).toEqual([204, 204])
    expect(await rows()).toHaveLength(0)
  })

  //checked before it is dropped, so a test still learns it sent a bad event
  it("still refuses an automated event that is not valid", async () => {
    const response = await post({
      ...start(gameRef()),
      automated: true,
      mode: "puzzle",
    })

    expect(response.status).toBe(400)
  })

  //---- what it refuses ----------------

  it.each([
    ["no body at all", ""],
    ["a body that is not json", "kind=start"],
    ["an unknown kind", { ...start(gameRef()), kind: "pause" }],
    ["an unknown mode", { ...start(gameRef()), mode: "puzzle" }],
    //online games are counted by the server, never by the client
    [
      "the online mode",
      { ...start(gameRef()), mode: "online", botLevel: null },
    ],
    [
      "a ref that is not a uuid",
      { ...start(gameRef()), gameRef: "player-1" },
    ],
    ["a bot level out of range", { ...start(gameRef()), botLevel: 9 }],
    [
      "a bot game with no level",
      { ...start(gameRef()), botLevel: undefined },
    ],
    [
      "a pass and play game with a bot level",
      { ...start(gameRef()), mode: "local", botLevel: 2 },
    ],
    [
      "a finish with no result",
      { ...start(gameRef()), kind: "finish", moveCount: 3 },
    ],
    [
      "a bot game finished with a colour",
      {
        ...start(gameRef()),
        kind: "finish",
        result: "black",
        moveCount: 3,
      },
    ],
    [
      "a pass and play game finished with a win",
      {
        gameRef: gameRef(),
        kind: "finish",
        mode: "local",
        result: "win",
        moveCount: 3,
        appVersion: "abc1234",
      },
    ],
    [
      "a negative move count",
      {
        ...start(gameRef()),
        kind: "finish",
        result: "win",
        moveCount: -1,
      },
    ],
    [
      "a guided flag that is not a boolean",
      { ...start(gameRef()), guided: "yes" },
    ],
    //only the start says whether the guide was showing
    [
      "a finish that says it was guided",
      {
        ...start(gameRef()),
        kind: "finish",
        result: "win",
        moveCount: 3,
        guided: true,
      },
    ],
    [
      "an automated flag that is not a boolean",
      { ...start(gameRef()), automated: "yes" },
    ],
    [
      "a field we do not collect",
      { ...start(gameRef()), userId: "someone" },
    ],
    [
      "an oversized body",
      { ...start(gameRef()), appVersion: "x".repeat(4_000) },
    ],
  ])("refuses %s with invalid_input", async (_, body) => {
    const response = await post(body)

    expect(response.status).toBe(400)
    const envelope = (await response.json()) as Envelope<unknown>
    expect(envelope.error_code).toBe("invalid_input")
    expect(await rows()).toHaveLength(0)
  })

  it("sheds a device that posts more than a game ever would", async () => {
    const statuses: number[] = []
    for (let index = 0; index < 31; index++) {
      const response = await post(start(gameRef()), { bypass: false })
      statuses.push(response.status)
    }

    expect(statuses.slice(0, 30).every((status) => status === 204)).toBe(
      true,
    )
    expect(statuses[30]).toBe(429)
    expect(await rows()).toHaveLength(30)
  })

  //---- what it never keeps ----------------

  it("has no column for a person, an address or a device", async () => {
    const { results } = await env.DB.prepare(
      "select name from pragma_table_info('game_events') order by name",
    ).all<{ name: string }>()

    expect(results.map((column) => column.name)).toEqual(ALLOWED_COLUMNS)
  })

  it("keeps nothing from the request beyond the event itself", async () => {
    const signedIn = await signUp("eventer")

    await post(start(gameRef()), {
      headers: {
        authorization: `Bearer ${signedIn.token}`,
        "user-agent": "Mozilla/5.0 (iPhone; CPU iPhone OS 18_0)",
        cookie: "abalone.session=secret",
      },
    })

    const stored = JSON.stringify(await rows())
    expect(stored).not.toContain(CLIENT_IP)
    expect(stored).not.toContain(signedIn.userId)
    expect(stored).not.toContain("iPhone")
    expect(stored).not.toContain("secret")
  })

  //---- online games, counted by the server ----------------

  let handles = 0
  async function signUp(role: string) {
    handles += 1
    const username = `${role}${handles}`
    const response = await worker.fetch(
      new Request("http://example.com/api/v1/auth/sign-up/email", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          origin: "http://example.com",
          "x-test-bypass": "true",
        },
        body: JSON.stringify({
          username,
          name: username,
          email: `${username}@users.abalone.invalid`,
          password: "correct-horse",
        }),
      }),
      env as never,
      newExecutionContext(),
    )
    const body = (await response.json()) as { user?: { id: string } }
    return {
      username,
      userId: body.user?.id ?? "",
      token: response.headers.get("set-auth-token") ?? "",
    }
  }

  async function call<Data>(
    method: string,
    path: string,
    token: string,
    body?: unknown,
    headers: Record<string, string> = {},
  ) {
    const context = newExecutionContext()
    const response = await worker.fetch(
      new Request(`http://example.com/api/v1${path}`, {
        method,
        headers: {
          origin: "http://example.com",
          "x-test-bypass": "true",
          authorization: `Bearer ${token}`,
          "content-type": "application/json",
          ...headers,
        },
        body: body === undefined ? undefined : JSON.stringify(body),
      }),
      env as never,
      context,
    )
    //the event is written off the player's path, so wait for it
    await context.settled()
    const envelope = (await response.json()) as Envelope<Data>
    if (!envelope.data)
      throw new Error(`${method} ${path} failed: ${envelope.error_code}`)
    return envelope.data
  }

  async function openOnlineGame(headers: Record<string, string> = {}) {
    const sender = await signUp("sender")
    const recipient = await signUp("recipient")
    const { invite } = await call<{ invite: Invite }>(
      "POST",
      "/invites",
      sender.token,
      {
        username: recipient.username,
        setupType: "standard",
        side: "black",
      },
    )
    const { game } = await call<{ game: Game }>(
      "POST",
      "/games",
      recipient.token,
      { inviteId: invite.id },
      headers,
    )
    return { sender, recipient, game }
  }

  it("counts an online game as started when the invite is accepted", async () => {
    await openOnlineGame()

    const stored = await rows()
    expect(stored).toEqual([
      expect.objectContaining({
        kind: "start",
        mode: "online",
        bot_level: null,
        result: null,
        //an online game never shows the guide
        guided: 0,
      }),
    ])
  })

  it("counts an online game as finished, with its winner, when it ends", async () => {
    const { sender, game } = await openOnlineGame()

    //the sender plays black, so resigning hands white the game
    await call("POST", `/games/${game.id}/resignation`, sender.token)

    const finishes = (await rows()).filter((row) => row.kind === "finish")
    expect(finishes).toEqual([
      expect.objectContaining({
        mode: "online",
        result: "white",
        move_count: 0,
      }),
    ])
  })

  it("does not count an online game a headless browser plays", async () => {
    const headless = { "user-agent": HEADLESS_CHROME }
    const { sender, game } = await openOnlineGame(headless)
    await call(
      "POST",
      `/games/${game.id}/resignation`,
      sender.token,
      undefined,
      headless,
    )

    expect(await rows()).toHaveLength(0)
  })

  it("never ties an online event back to the game or its players", async () => {
    const { sender, recipient, game } = await openOnlineGame()
    await call("POST", `/games/${game.id}/resignation`, sender.token)

    const stored = JSON.stringify(await rows())
    expect(stored).not.toContain(game.id)
    expect(stored).not.toContain(sender.userId)
    expect(stored).not.toContain(recipient.userId)
  })
})
