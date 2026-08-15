import { Logger } from "@repo/shared/logging"
import tryCatch from "@repo/shared/try-catch"
import type { RealtimeEvent } from "@/modules/realtime/events"
import type { PubSub } from "@/modules/realtime/pubsub.do"

const log = new Logger("realtime")

/**
 * Channels are per player, not per game.
 *
 * Every event this app has affects one or two named players, so addressing them
 * directly means one socket per device covering every screen: the board, the
 * invite list and the games list all read the same connection, and walking from
 * one to another reconnects nothing. A game channel would have to be joined and
 * left, and would leave the lobby needing a second socket of its own.
 *
 * The cost is that a game event is published twice rather than once. That is
 * two stub calls against objects that are usually asleep, which is the cheaper
 * half of the trade.
 */
export function userChannel(userId: string): string {
  return `user:${userId}`
}

/**
 * Tells each named player that something they can see has changed.
 *
 * Every publish is best effort by design. A player with nothing connected still
 * has their object woken to be told, and that is fine — it is a request against
 * an empty channel, no storage is touched, and the alternative is tracking
 * presence, which would be a second source of truth about who is listening.
 *
 * Nothing here is worth failing a request over: the client that missed a beacon
 * still refetches on focus and still has its polling fallback. So a failure is
 * logged and the rest of the fan-out carries on.
 */
export async function publishToUsers(
  namespace: DurableObjectNamespace<PubSub>,
  userIds: string[],
  payload: RealtimeEvent,
): Promise<void> {
  //both seats of a game are always two different players today, but a set costs
  //one line and settles the question
  const channels = [...new Set(userIds)].map(userChannel)

  await Promise.all(
    channels.map(async (channel) => {
      const stub = namespace.get(namespace.idFromName(channel))
      const [, publishError] = await tryCatch(() => stub.publish(payload))
      if (publishError) {
        log.error("realtime_publish_failed", publishError, {
          channel,
          event: payload.event,
        })
      }
    }),
  )
}
