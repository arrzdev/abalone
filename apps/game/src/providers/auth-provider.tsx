import type { ReactNode } from "react"
import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react"
import type { AuthSessionUser } from "@/data/auth/client"
import { useSessionState } from "@/data/auth/client"
import {
  readSessionSnapshot,
  writeSessionSnapshot,
} from "@/data/auth/session-snapshot"

//---- Auth provider ------------------------------------------------
//the single owner of auth. it subscribes to the session ONCE and exposes it as
//app-wide state, so every consumer reads the same answer and no page runs its
//own guard. offline play never asks — a guest is a supported state, not an
//error, and nothing here redirects anyone to a login screen.
//
//STALE-WHILE-REVALIDATE, in two parts, because the requirement is that moving
//between screens never re-gates or flashes:
//
//  1. a latch. better-auth revalidates in the background (on tab refocus) and
//     flips its own `isPending` back to true while it does. we report pending
//     only until the FIRST resolve; after that the cached answer keeps being
//     served and navigation never sees a loading state again.
//  2. a snapshot. a cold start has no cached session at all, so the first paint
//     comes from what this device last knew (data/auth/session-snapshot.ts) and
//     the network confirms it a moment later.

type AuthContextValue = {
  /** The signed-in player, or null for a guest. Served from cache. */
  user: AuthSessionUser | null
  isAuthenticated: boolean
  /**
   * True only while this device has never resolved a session and the first
   * answer has not arrived. It never flips back to true, so do NOT read it as a
   * per-render loading gate.
   */
  isPending: boolean
}

const AuthContext = createContext<AuthContextValue>({
  user: null,
  isAuthenticated: false,
  isPending: true,
})

export function AuthProvider({ children }: { children: ReactNode }) {
  const { user: liveUser, isPending: rawIsPending } = useSessionState()

  //read once — a snapshot is only ever about the first paint
  const [snapshot] = useState(readSessionSnapshot)

  const [hasSettled, setHasSettled] = useState(false)
  useEffect(() => {
    if (rawIsPending || hasSettled) return
    setHasSettled(true)
  }, [rawIsPending, hasSettled])

  //keep the snapshot current, so the next cold start paints this answer
  useEffect(() => {
    if (rawIsPending) return
    writeSessionSnapshot(liveUser)
  }, [rawIsPending, liveUser])

  //before the first resolve the snapshot speaks; after it, the session does
  const user = hasSettled ? liveUser : (snapshot?.user ?? liveUser)
  //a snapshot of `{ user: null }` is a real answer, so a returning guest is not
  //pending either — only a device that has never resolved anything is
  const isPending = !hasSettled && snapshot === null

  const value = useMemo<AuthContextValue>(
    () => ({ user, isAuthenticated: Boolean(user), isPending }),
    [user, isPending],
  )

  return (
    <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
  )
}

/** Cached auth state. The one hook every consumer reads. */
export function useAuth() {
  return useContext(AuthContext)
}
