import { useQueryClient } from "@tanstack/react-query"
import type { ReactNode } from "react"
import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react"
import { openRealtimeChannel } from "@/data/realtime/channel"
import { applyRealtimeEvent } from "@/data/realtime/invalidate"
import { useAuth } from "@/providers/auth-provider"

//---- Realtime provider --------------------------------------------
//one socket for the whole app, for the signed-in player, because channels are
//per player rather than per game. every online screen reads the same connection
//and walking from the lobby to a board reconnects nothing.
//
//it sits inside the persisting query client on purpose: that provider is what
//restores the saved cache, and a channel that started marking queries stale
//before the restore landed would be arguing with it.
//
//a guest never opens one. offline play asks the server nothing, so there is
//nothing for a channel to say.

type RealtimeContextValue = {
  /**
   * Whether a socket is currently open.
   *
   * Screens read this to decide whether to poll. False is not an error state:
   * it means the app is back to asking on a timer, which is exactly what it did
   * before any of this existed.
   */
  isConnected: boolean
}

const RealtimeContext = createContext<RealtimeContextValue>({
  isConnected: false,
})

export function RealtimeProvider({ children }: { children: ReactNode }) {
  const queryClient = useQueryClient()
  const { isAuthenticated } = useAuth()
  const [isConnected, setIsConnected] = useState(false)

  useEffect(() => {
    if (!isAuthenticated) {
      //signing out tears the channel down through here: the session flips, this
      //re-runs, and the socket that would keep retrying with a dead token goes
      setIsConnected(false)
      return
    }

    return openRealtimeChannel({
      onConnectedChange: setIsConnected,
      onEvent: (event) => applyRealtimeEvent(queryClient, event),
    })
  }, [isAuthenticated, queryClient])

  const value = useMemo<RealtimeContextValue>(
    () => ({ isConnected }),
    [isConnected],
  )

  return (
    <RealtimeContext.Provider value={value}>
      {children}
    </RealtimeContext.Provider>
  )
}

/** Whether the push channel is up, so a screen knows whether to poll. */
export function useRealtime() {
  return useContext(RealtimeContext)
}
