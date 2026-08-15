import { env } from "cloudflare:workers"
import { getPossibleMoves } from "@repo/abalone-engine/rules"
import type { CellName, Player } from "@repo/abalone-engine/types"
import { beforeAll, describe, expect, it } from "vitest"
import worker from "@/entrypoint"
import { envRegistry } from "@/env/registry"
import type { Game, GameMove } from "@/services/game.service"
import type { Invite } from "@/services/invite.service"

type Envelope<Data> = {
  status: string
  error_code?: string
  data?: Data
}

type Move = { marbles: CellName[]; destination: CellName }

describe("game routes", () => {
  beforeAll(() => {
    envRegistry.setEnv(env as unknown as Record<string, unknown>)
  })

  //---- talking to the worker ----------------

  function fetchWorker(request: Request) {
    return worker.fetch(request, env as never, {} as ExecutionContext)
  }

  async function call<Data>(
    method: string,
    path: string,
    token: string,
    body?: unknown,
  ) {
    const headers: Record<string, string> = {
      origin: "http://example.com",
      "x-test-bypass": "true",
    }
    if (token) headers.authorization = `Bearer ${token}`
    if (body !== undefined) headers["content-type"] = "application/json"

    const response = await fetchWorker(
      new Request(`http://example.com/api/v1${path}`, {
        method,
        headers,
        body: body === undefined ? undefined : JSON.stringify(body),
      }),
    )
    return {
      response,
      body: (await response.json()) as Envelope<Data>,
    }
  }

  //usernames have to be unique across the whole suite, and each test signs up
  //its own cast, so the caller names them and the counter keeps them apart
  let handles = 0
  async function signUp(role: string) {
    handles += 1
    const username = `${role}${handles}`
    const response = await fetchWorker(
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
    )
    return {
      username,
      token: response.headers.get("set-auth-token") ?? "",
    }
  }

  //---- the shortest path to two people playing ----------------

  async function invite(
    from: string,
    username: string,
    side: "black" | "white" | "random" = "black",
  ) {
    const { body } = await call<{ invite: Invite }>(
      "POST",
      "/invites",
      from,
      {
        username,
        setupType: "standard",
        side,
      },
    )
    if (!body.data) throw new Error(`invite failed: ${body.error_code}`)
    return body.data.invite
  }

  async function accept(token: string, inviteId: string) {
    const { body } = await call<{ game: Game }>("POST", "/games", token, {
      inviteId,
    })
    if (!body.data) throw new Error(`accept failed: ${body.error_code}`)
    return body.data.game
  }

  /** Two fresh accounts with a game already open between them. */
  async function openGame() {
    const sender = await signUp("sender")
    const recipient = await signUp("recipient")
    const sent = await invite(sender.token, recipient.username)
    const game = await accept(recipient.token, sent.id)

    //the invite named black for its sender, so the seats are known
    return { sender, recipient, game, inviteId: sent.id }
  }

  function boardOf(game: Game) {
    return {
      black: new Set(game.blackCells),
      white: new Set(game.whiteCells),
    }
  }

  /**
   * A move the position actually offers, found with the engine.
   *
   * Hard-coding one would only be a test of the standard opening; asking the
   * engine keeps every test below about what the server does with a legal move
   * rather than about which move it happens to be. `side` names whose move to
   * find, which is how the tests below reach for one that is not the caller's.
   */
  function legalMove(game: Game, side: Player = game.currentTurn): Move {
    const board = boardOf(game)
    const own = side === "black" ? game.blackCells : game.whiteCells

    for (const cell of own) {
      const [destination] = getPossibleMoves(
        board,
        [cell],
        side === "black",
      )
      if (destination) return { marbles: [cell], destination }
    }
    throw new Error(`the position offers ${side} no move`)
  }

  async function play(token: string, game: Game, move?: Move) {
    const { marbles, destination } = move ?? legalMove(game)
    return call<{ game: Game }>("POST", `/games/${game.id}/moves`, token, {
      marbles,
      destination,
      moveIndex: game.moveCount,
    })
  }

  //---- invites ----------------

  it("sends an invite and shows it to both sides", async () => {
    const sender = await signUp("caller")
    const recipient = await signUp("callee")

    const { response, body } = await call<{ invite: Invite }>(
      "POST",
      "/invites",
      sender.token,
      {
        username: recipient.username,
        setupType: "belgian_daisy",
        side: "white",
      },
    )

    expect(response.status).toBe(201)
    expect(body.data?.invite).toMatchObject({
      setupType: "belgian_daisy",
      side: "white",
      status: "pending",
      from: { username: sender.username },
      to: { username: recipient.username },
    })

    const theirs = await call<{ invites: Invite[] }>(
      "GET",
      "/invites",
      recipient.token,
    )
    expect(theirs.body.data?.invites).toHaveLength(1)
  })

  it("finds a player whatever case the handle was typed in", async () => {
    const sender = await signUp("typist")
    const recipient = await signUp("target")

    const { response } = await call("POST", "/invites", sender.token, {
      username: recipient.username.toUpperCase(),
      setupType: "standard",
      side: "random",
    })

    expect(response.status).toBe(201)
  })

  it("refuses an invite to a handle nobody holds", async () => {
    const sender = await signUp("lonely")

    const { response, body } = await call(
      "POST",
      "/invites",
      sender.token,
      {
        username: "nobody-at-all",
        setupType: "standard",
        side: "black",
      },
    )

    expect(response.status).toBe(404)
    expect(body.error_code).toBe("player_not_found")
  })

  it("refuses an invite to yourself", async () => {
    const solo = await signUp("solo")

    const { response, body } = await call("POST", "/invites", solo.token, {
      username: solo.username,
      setupType: "standard",
      side: "black",
    })

    expect(response.status).toBe(400)
    expect(body.error_code).toBe("invite_self")
  })

  it("refuses a second invite to the same player", async () => {
    const sender = await signUp("keen")
    const recipient = await signUp("popular")
    await invite(sender.token, recipient.username)

    const { response, body } = await call(
      "POST",
      "/invites",
      sender.token,
      {
        username: recipient.username,
        setupType: "standard",
        side: "black",
      },
    )

    expect(response.status).toBe(409)
    expect(body.error_code).toBe("invite_exists")
  })

  it("lets the sender ask again after a decline", async () => {
    const sender = await signUp("persistent")
    const recipient = await signUp("reluctant")
    const sent = await invite(sender.token, recipient.username)

    const declined = await call<{ invite: Invite }>(
      "PATCH",
      `/invites/${sent.id}`,
      recipient.token,
      { status: "declined" },
    )
    expect(declined.body.data?.invite.status).toBe("declined")

    const again = await call<{ invite: Invite }>(
      "POST",
      "/invites",
      sender.token,
      {
        username: recipient.username,
        setupType: "the_wall",
        side: "white",
      },
    )
    expect(again.response.status).toBe(201)
    expect(again.body.data?.invite).toMatchObject({
      status: "pending",
      setupType: "the_wall",
    })
  })

  it("lets the sender take an invite back", async () => {
    const sender = await signUp("changed")
    const recipient = await signUp("waiting")
    const sent = await invite(sender.token, recipient.username)

    const { response } = await call(
      "DELETE",
      `/invites/${sent.id}`,
      sender.token,
    )
    expect(response.status).toBe(200)

    const theirs = await call<{ invites: Invite[] }>(
      "GET",
      "/invites",
      recipient.token,
    )
    expect(theirs.body.data?.invites).toHaveLength(0)
  })

  //---- opening a game ----------------

  it("opens a game on the invite's terms and clears the invite", async () => {
    const sender = await signUp("host")
    const recipient = await signUp("guest")
    const sent = await invite(sender.token, recipient.username, "white")

    const { response, body } = await call<{ game: Game }>(
      "POST",
      "/games",
      recipient.token,
      { inviteId: sent.id },
    )

    expect(response.status).toBe(201)
    expect(body.data?.game).toMatchObject({
      status: "active",
      setupType: "standard",
      currentTurn: "black",
      moveCount: 0,
      blackScore: 0,
      whiteScore: 0,
      winner: null,
      finishReason: null,
      //the sender asked for white, so the recipient takes black
      black: { username: recipient.username },
      white: { username: sender.username },
    })

    const left = await call<{ invites: Invite[] }>(
      "GET",
      "/invites",
      sender.token,
    )
    expect(left.body.data?.invites).toHaveLength(0)
  })

  it("records the opening position as ply 0", async () => {
    const { game, recipient } = await openGame()

    const { body } = await call<{ moves: GameMove[] }>(
      "GET",
      `/games/${game.id}/moves`,
      recipient.token,
    )

    expect(body.data?.moves).toHaveLength(1)
    expect(body.data?.moves[0]).toMatchObject({
      moveIndex: 0,
      marbles: null,
      destination: null,
      currentTurn: "black",
      blackScore: 0,
      whiteScore: 0,
    })
    expect(body.data?.moves[0].blackCells).toEqual(game.blackCells)
  })

  it("hands back the same game when an invite is accepted twice", async () => {
    const sender = await signUp("twice")
    const recipient = await signUp("eager")
    const sent = await invite(sender.token, recipient.username)

    const [first, second] = await Promise.all([
      call<{ game: Game }>("POST", "/games", recipient.token, {
        inviteId: sent.id,
      }),
      call<{ game: Game }>("POST", "/games", recipient.token, {
        inviteId: sent.id,
      }),
    ])

    const opened = [first, second].filter((it) => it.body.data)
    expect(opened.length).toBeGreaterThanOrEqual(1)

    const ids = new Set(opened.map((it) => it.body.data?.game.id))
    expect(ids.size).toBe(1)

    const mine = await call<{ games: Game[] }>(
      "GET",
      "/games?status=active",
      recipient.token,
    )
    expect(mine.body.data?.games).toHaveLength(1)
  })

  //---- playing ----------------

  it("plays a legal move and passes the turn", async () => {
    const { game, sender } = await openGame()

    const { response, body } = await play(sender.token, game)

    expect(response.status).toBe(201)
    expect(body.data?.game).toMatchObject({
      moveCount: 1,
      currentTurn: "white",
      status: "active",
    })
    expect(body.data?.game.blackCells).not.toEqual(game.blackCells)
  })

  it("appends the move to the history", async () => {
    const { game, sender, recipient } = await openGame()
    const move = legalMove(game)
    await play(sender.token, game, move)

    const { body } = await call<{ moves: GameMove[] }>(
      "GET",
      `/games/${game.id}/moves`,
      recipient.token,
    )

    expect(body.data?.moves).toHaveLength(2)
    expect(body.data?.moves[1]).toMatchObject({
      moveIndex: 1,
      marbles: move.marbles,
      destination: move.destination,
      currentTurn: "white",
    })
  })

  it("refuses a move from the player who is not to play", async () => {
    const { game, recipient } = await openGame()

    //black opens and the recipient took white, so this is out of turn
    const { response, body } = await call(
      "POST",
      `/games/${game.id}/moves`,
      recipient.token,
      { ...legalMove(game), moveIndex: 0 },
    )

    expect(response.status).toBe(409)
    expect(body.error_code).toBe("not_your_turn")
  })

  it("refuses a move onto a square the position does not offer", async () => {
    const { game, sender } = await openGame()
    const marble = game.blackCells[0]

    const { response, body } = await call(
      "POST",
      `/games/${game.id}/moves`,
      sender.token,
      { marbles: [marble], destination: "0,0", moveIndex: 0 },
    )

    expect(response.status).toBe(400)
    expect(body.error_code).toBe("illegal_move")
  })

  it("refuses to move marbles that are not yours", async () => {
    const { game, sender } = await openGame()
    //a move that is legal in itself, played by the wrong owner
    const theirs = legalMove(game, "white")

    const { response, body } = await call(
      "POST",
      `/games/${game.id}/moves`,
      sender.token,
      { ...theirs, moveIndex: 0 },
    )

    expect(response.status).toBe(400)
    expect(body.error_code).toBe("illegal_move")
  })

  it("refuses to move a marble that is not there", async () => {
    const { game, sender } = await openGame()
    //the centre is empty in every opening. a body naming it would have the
    //engine step a marble out of nowhere if nothing checked first.
    const [destination] = getPossibleMoves(boardOf(game), ["0,0"], true)

    const { response, body } = await call(
      "POST",
      `/games/${game.id}/moves`,
      sender.token,
      { marbles: ["0,0"], destination, moveIndex: 0 },
    )

    expect(response.status).toBe(400)
    expect(body.error_code).toBe("illegal_move")

    const after = await call<{ game: Game }>(
      "GET",
      `/games/${game.id}`,
      sender.token,
    )
    expect(after.body.data?.game.blackCells).toEqual(game.blackCells)
    expect(after.body.data?.game.moveCount).toBe(0)
  })

  it("refuses marbles that do not stand in a line", async () => {
    const { game, sender } = await openGame()
    //two of their own, from opposite ends of the back rank
    const scattered = [
      game.blackCells[0],
      game.blackCells[game.blackCells.length - 1],
    ]

    const { response, body } = await call(
      "POST",
      `/games/${game.id}/moves`,
      sender.token,
      {
        marbles: scattered,
        destination: game.blackCells[1],
        moveIndex: 0,
      },
    )

    expect(response.status).toBe(400)
    expect(body.error_code).toBe("illegal_move")
  })

  it("refuses a move aimed at a position the game has left", async () => {
    const { game, sender, recipient } = await openGame()
    const played = await play(sender.token, game)
    const now = played.body.data?.game
    if (!now) throw new Error("the opening move did not land")

    //white is to play, and their move is legal — but they were still looking
    //at the board as it stood before black moved
    const stale = await call(
      "POST",
      `/games/${game.id}/moves`,
      recipient.token,
      { ...legalMove(now), moveIndex: 0 },
    )

    expect(stale.response.status).toBe(409)
    expect(stale.body.error_code).toBe("move_conflict")
  })

  it("ignores anything in the body that is not the move", async () => {
    const { game, sender } = await openGame()

    const { response } = await call(
      "POST",
      `/games/${game.id}/moves`,
      sender.token,
      {
        ...legalMove(game),
        moveIndex: 0,
        blackCells: ["0,0"],
        whiteCells: ["0,1"],
        blackScore: 6,
        status: "finished",
        winner: "black",
        finishReason: "score",
      },
    )

    expect(response.status).toBe(201)

    const after = await call<{ game: Game }>(
      "GET",
      `/games/${game.id}`,
      sender.token,
    )
    expect(after.body.data?.game).toMatchObject({
      status: "active",
      winner: null,
      finishReason: null,
      blackScore: 0,
      whiteScore: 0,
    })
    expect(after.body.data?.game.blackCells).not.toEqual(["0,0"])
  })

  //---- ending ----------------

  it("finishes a game on a resignation, and names the other seat", async () => {
    const { game, sender, recipient } = await openGame()

    const { response, body } = await call<{ game: Game }>(
      "POST",
      `/games/${game.id}/resignation`,
      sender.token,
    )

    expect(response.status).toBe(200)
    expect(body.data?.game).toMatchObject({
      status: "finished",
      winner: "white",
      finishReason: "resignation",
    })

    const listed = await call<{ games: Game[] }>(
      "GET",
      "/games?status=finished",
      recipient.token,
    )
    expect(listed.body.data?.games).toHaveLength(1)
  })

  it("refuses a move once the game is over", async () => {
    const { game, sender } = await openGame()
    await call("POST", `/games/${game.id}/resignation`, sender.token)

    const { response, body } = await play(sender.token, game)

    expect(response.status).toBe(409)
    expect(body.error_code).toBe("game_not_active")
  })

  it("refuses a second resignation", async () => {
    const { game, sender, recipient } = await openGame()
    await call("POST", `/games/${game.id}/resignation`, sender.token)

    const { response, body } = await call(
      "POST",
      `/games/${game.id}/resignation`,
      recipient.token,
    )

    expect(response.status).toBe(409)
    expect(body.error_code).toBe("game_not_active")
  })

  //---- the gate ----------------
  //everything below is the security audit: a third account who is party to
  //nothing, and requests carrying no session or a made-up one. a game or an
  //invite somebody else is in answers exactly as one that never existed.

  describe("an outsider", () => {
    it("cannot read the game", async () => {
      const { game } = await openGame()
      const outsider = await signUp("outsider")

      const { response, body } = await call(
        "GET",
        `/games/${game.id}`,
        outsider.token,
      )

      expect(response.status).toBe(404)
      expect(body.error_code).toBe("not_found")
    })

    it("cannot read the moves", async () => {
      const { game } = await openGame()
      const outsider = await signUp("outsider")

      const { response, body } = await call(
        "GET",
        `/games/${game.id}/moves`,
        outsider.token,
      )

      expect(response.status).toBe(404)
      expect(body.error_code).toBe("not_found")
    })

    it("cannot play a move", async () => {
      const { game } = await openGame()
      const outsider = await signUp("outsider")

      const { response, body } = await call(
        "POST",
        `/games/${game.id}/moves`,
        outsider.token,
        { ...legalMove(game), moveIndex: 0 },
      )

      expect(response.status).toBe(404)
      expect(body.error_code).toBe("not_found")
    })

    it("cannot resign the game", async () => {
      const { game, sender } = await openGame()
      const outsider = await signUp("outsider")

      const { response, body } = await call(
        "POST",
        `/games/${game.id}/resignation`,
        outsider.token,
      )

      expect(response.status).toBe(404)
      expect(body.error_code).toBe("not_found")

      const after = await call<{ game: Game }>(
        "GET",
        `/games/${game.id}`,
        sender.token,
      )
      expect(after.body.data?.game.status).toBe("active")
    })

    it("cannot see the game in their own list", async () => {
      await openGame()
      const outsider = await signUp("outsider")

      const { body } = await call<{ games: Game[] }>(
        "GET",
        "/games?status=active",
        outsider.token,
      )

      expect(body.data?.games).toEqual([])
    })

    it("cannot accept somebody else's invite", async () => {
      const sender = await signUp("asker")
      const recipient = await signUp("asked")
      const outsider = await signUp("outsider")
      const sent = await invite(sender.token, recipient.username)

      const { response, body } = await call(
        "POST",
        "/games",
        outsider.token,
        { inviteId: sent.id },
      )

      expect(response.status).toBe(404)
      expect(body.error_code).toBe("not_found")

      //and it is still there for the person it was meant for
      const theirs = await call<{ invites: Invite[] }>(
        "GET",
        "/invites",
        recipient.token,
      )
      expect(theirs.body.data?.invites).toHaveLength(1)
    })

    it("cannot decline somebody else's invite", async () => {
      const sender = await signUp("asker")
      const recipient = await signUp("asked")
      const outsider = await signUp("outsider")
      const sent = await invite(sender.token, recipient.username)

      const { response, body } = await call(
        "PATCH",
        `/invites/${sent.id}`,
        outsider.token,
        { status: "declined" },
      )

      expect(response.status).toBe(404)
      expect(body.error_code).toBe("not_found")
    })

    it("cannot delete somebody else's invite", async () => {
      const sender = await signUp("asker")
      const recipient = await signUp("asked")
      const outsider = await signUp("outsider")
      const sent = await invite(sender.token, recipient.username)

      const { response, body } = await call(
        "DELETE",
        `/invites/${sent.id}`,
        outsider.token,
      )

      expect(response.status).toBe(404)
      expect(body.error_code).toBe("not_found")
    })

    it("cannot see somebody else's invite in their own list", async () => {
      const sender = await signUp("asker")
      const recipient = await signUp("asked")
      const outsider = await signUp("outsider")
      await invite(sender.token, recipient.username)

      const { body } = await call<{ invites: Invite[] }>(
        "GET",
        "/invites",
        outsider.token,
      )

      expect(body.data?.invites).toEqual([])
    })
  })

  describe("the sender of an invite", () => {
    it("cannot accept it themselves", async () => {
      const sender = await signUp("impatient")
      const recipient = await signUp("slow")
      const sent = await invite(sender.token, recipient.username)

      const { response, body } = await call(
        "POST",
        "/games",
        sender.token,
        { inviteId: sent.id },
      )

      expect(response.status).toBe(404)
      expect(body.error_code).toBe("not_found")
    })

    it("cannot decline it themselves", async () => {
      const sender = await signUp("impatient")
      const recipient = await signUp("slow")
      const sent = await invite(sender.token, recipient.username)

      const { response, body } = await call(
        "PATCH",
        `/invites/${sent.id}`,
        sender.token,
        { status: "declined" },
      )

      expect(response.status).toBe(404)
      expect(body.error_code).toBe("not_found")
    })
  })

  describe("the recipient of an invite", () => {
    it("cannot delete one they did not send", async () => {
      const sender = await signUp("owner")
      const recipient = await signUp("borrower")
      const sent = await invite(sender.token, recipient.username)

      const { response, body } = await call(
        "DELETE",
        `/invites/${sent.id}`,
        recipient.token,
      )

      expect(response.status).toBe(404)
      expect(body.error_code).toBe("not_found")
    })
  })

  describe("a request with no session", () => {
    const routes: [string, string, unknown?][] = [
      ["GET", "/invites"],
      [
        "POST",
        "/invites",
        { username: "x", setupType: "standard", side: "black" },
      ],
      ["GET", "/games"],
      ["POST", "/games", { inviteId: crypto.randomUUID() }],
      ["GET", `/games/${crypto.randomUUID()}`],
      ["GET", `/games/${crypto.randomUUID()}/moves`],
      ["POST", `/games/${crypto.randomUUID()}/resignation`],
    ]

    it.each(routes)("turns away %s %s", async (method, path, body) => {
      const guest = await call(method, path, "", body)
      expect(guest.response.status).toBe(401)
      expect(guest.body.error_code).toBe("unauthorized")

      const forged = await call(method, path, "forged.token.value", body)
      expect(forged.response.status).toBe(401)
      expect(forged.body.error_code).toBe("unauthorized")
    })
  })

  //---- the edge ----------------

  it("rejects a move body that is not a move", async () => {
    const { game, sender } = await openGame()

    const cases = [
      { marbles: [], destination: "0,0", moveIndex: 0 },
      { marbles: ["not a cell"], destination: "0,0", moveIndex: 0 },
      { marbles: ["0,0"], destination: "nope", moveIndex: 0 },
      {
        marbles: ["0,0", "0,1", "0,2", "0,3"],
        destination: "0,4",
        moveIndex: 0,
      },
      { marbles: ["0,0"], destination: "0,1", moveIndex: -1 },
    ]

    for (const body of cases) {
      const { response } = await call(
        "POST",
        `/games/${game.id}/moves`,
        sender.token,
        body,
      )
      expect(response.status).toBe(400)
    }
  })

  it("rejects an id that is not one", async () => {
    const player = await signUp("curious")

    const { response } = await call(
      "GET",
      "/games/not-a-uuid",
      player.token,
    )
    expect(response.status).toBe(400)
  })

  it("rejects a setup nobody can play", async () => {
    const sender = await signUp("creative")
    const recipient = await signUp("patient")

    const { response } = await call("POST", "/invites", sender.token, {
      username: recipient.username,
      setupType: "custom",
      side: "black",
    })

    expect(response.status).toBe(400)
  })
})
