import { clearSessionSnapshot } from "@/data/auth/session-snapshot"
import { getBearerToken, writeToken } from "@/data/auth/token"
import { clearProfileSnapshot } from "@/data/profile/snapshot"
import { queryClient } from "@/providers/query-client"
import { persister } from "@/providers/query-persister"

//---- The end of a session -----------------------------------------
//everything this device holds on behalf of the account, dropped in one call.
//
//two things end a session and only one of them is a button. the player presses
//sign out, or the server stops honouring the token — a session revoked, expired,
//or belonging to a database this deploy no longer has. the second one used to
//end as a red line under a board the app could no longer load: the token stayed,
//the saved games stayed, every request on the screen failed the same way, and
//the player was left reading "you need to be signed in" on a screen only a
//signed-in player can reach. it is the same event as the button, so it takes the
//same exit — and once the token is gone the route guard does the rest, which is
//home, with the sign-in sheet over it.

/**
 * Sign this device out locally: token, snapshots, and the cached account data.
 *
 * Idempotent, and deliberately so. A refused session is usually refused several
 * times at once — a board polls its row, its moves and the profile behind the
 * header — and the first answer back is the one that ends it.
 */
export function endSession(): void {
  if (!getBearerToken()) return

  writeToken(null)
  clearSessionSnapshot()
  clearProfileSnapshot()

  //the cache is the last account's games, and the saved copy of it is dropped
  //by hand rather than left to the persister's throttled write: "your games are
  //off this device" should not be true a second after the session ended
  queryClient.clear()
  void persister.removeClient()
}
