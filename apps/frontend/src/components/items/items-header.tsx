import { useNavigate } from "@tanstack/react-router"
import { Settings } from "lucide-react"
import { SyncStatusBar } from "@/components/sync-status-bar"
import { IconButton } from "@/components/ui"
import { formatCount } from "@/components/ui/format-count"
import { useAppVibrate } from "@/hooks/use-app-vibrate"
import { useAuth } from "@/providers/auth-provider"

type ItemsHeaderProps = {
  count: number
  isLoading?: boolean
}

export function ItemsHeader({
  count,
  isLoading = false,
}: ItemsHeaderProps) {
  const navigate = useNavigate()
  const { hapticPointerHandlers } = useAppVibrate()
  //the sync indicator is a signed-in concept only — guests are fully local
  const { isAuthenticated } = useAuth()
  const settingsHandlers = hapticPointerHandlers(
    () => navigate({ to: "/settings" }),
    "ok",
  )

  return (
    <header className="flex shrink-0 items-center justify-between gap-4">
      <div className="flex min-w-0 flex-1 flex-col gap-y-1">
        <h1 className="truncate text-4xl font-semibold tracking-tight text-foreground">
          Items
        </h1>
        <p
          className="min-h-lh pl-1 text-sm text-subtle"
          aria-busy={isLoading || undefined}
        >
          {isLoading ? "Loading…" : formatCount(count, "item", "items")}
        </p>
      </div>
      {/* self-stretch + items-center keeps the button row vertically centered
          against the title/subtitle block; the sync indicator is absolutely
          positioned on the subtitle line, so mounting it on sign-in never
          nudges the buttons */}
      <div className="relative flex shrink-0 items-center self-stretch">
        <IconButton
          onClick={settingsHandlers.onClick}
          aria-label="Settings"
          className="bg-surface"
        >
          <Settings size={20} strokeWidth={1.75} aria-hidden />
        </IconButton>
        {isAuthenticated && (
          <div className="absolute inset-x-0 bottom-0 flex translate-y-[3px]">
            <SyncStatusBar />
          </div>
        )}
      </div>
    </header>
  )
}
