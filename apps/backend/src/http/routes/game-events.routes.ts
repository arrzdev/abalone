import { newEndpoint } from "@repo/shared/http"
import tryCatch from "@repo/shared/try-catch"
import { z } from "zod"
import { getDb } from "@/database/client"
import type { Env } from "@/env/registry"
import { CustomError } from "@/http/errors"
import { rateLimit } from "@/http/middlewares/rate-limit"
import { GameEventService } from "@/services/game-event.service"

//a real event is about 150 bytes. anything near this is not one.
const MAX_BODY_LENGTH = 1_024

//---- schemas ----------------
//strict objects, so a field we do not collect is refused rather than dropped:
//a client sending one is a client that thinks we keep it. `online` is not here
//at all, because online games are counted by the game routes themselves.

const eventFields = {
  gameRef: z.uuid(),
  appVersion: z.string().min(1).max(40),
}

const moveCountSchema = z.int().min(0).max(10_000)

const botLevelSchema = z.int().min(1).max(8)

//a pass and play game has no bot, so it may say nothing or say null
const noBotLevelSchema = z.null().optional()

const gameEventSchema = z.union([
  z.strictObject({
    ...eventFields,
    kind: z.literal("start"),
    mode: z.literal("ai"),
    botLevel: botLevelSchema,
  }),
  z.strictObject({
    ...eventFields,
    kind: z.literal("start"),
    mode: z.literal("local"),
    botLevel: noBotLevelSchema,
  }),
  z.strictObject({
    ...eventFields,
    kind: z.literal("finish"),
    mode: z.literal("ai"),
    botLevel: botLevelSchema,
    //from the human's side
    result: z.enum(["win", "loss", "draw", "abandoned"]),
    moveCount: moveCountSchema,
  }),
  z.strictObject({
    ...eventFields,
    kind: z.literal("finish"),
    mode: z.literal("local"),
    botLevel: noBotLevelSchema,
    //the winner, since both sides are the same person
    result: z.enum(["black", "white", "draw", "abandoned"]),
    moveCount: moveCountSchema,
  }),
])

/** What the game posts when one of its games starts or finishes. */
export type GameEventInput = z.infer<typeof gameEventSchema>

/**
 * Reads the event out of the request, whatever it says its body is.
 *
 * `sendBeacon` with a string labels it `text/plain`, and that is the only way a
 * page that is closing can still send something. So `valid("json")`, which
 * insists on a json content type, cannot sit in front of this route: the body
 * is read as text and parsed here instead.
 */
async function readGameEvent(request: Request): Promise<GameEventInput> {
  const [text, readError] = await tryCatch(() => request.text())
  if (readError) throw new CustomError("invalid_input", readError)
  if (text.length > MAX_BODY_LENGTH) throw new CustomError("invalid_input")

  const [body, parseError] = tryCatch(() => JSON.parse(text) as unknown)
  if (parseError) throw new CustomError("invalid_input", parseError)

  const parsed = gameEventSchema.safeParse(body)
  if (!parsed.success) throw new CustomError("invalid_input")
  return parsed.data
}

//---- routes ----------------

export const gameEventRoutes = newEndpoint<Env>()
  //no auth: a bot game needs no account, and counting it must not ask for one.
  //the limit counts by ip in worker memory and never writes it anywhere.
  .use("*", rateLimit("events"))

  //---- record ----------------

  .post("/game", async (c) => {
    const event = await readGameEvent(c.req.raw)
    const gameEventService = new GameEventService(getDb(c.env.DB))
    await gameEventService.record({
      gameRef: event.gameRef,
      kind: event.kind,
      mode: event.mode,
      botLevel: event.botLevel ?? null,
      result: "result" in event ? event.result : null,
      moveCount: "moveCount" in event ? event.moveCount : null,
      appVersion: event.appVersion,
    })

    //a beacon never reads its answer, so there is nothing to put in one
    return c.body(null, 204)
  })
