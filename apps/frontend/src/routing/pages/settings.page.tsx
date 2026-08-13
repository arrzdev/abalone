import { EdgeSwipeGestures } from "@repo/nativ/components"
import {
  useVibrate as useBaseVibrate,
  useMediaQuery,
  useTheme,
} from "@repo/nativ/hooks"
import { createFileRoute, useRouter } from "@tanstack/react-router"
import { Moon, Sparkles, Vibrate } from "lucide-react"
import { PageWithSmoothEdges } from "@/components/page"
import { SettingsAccountCard } from "@/components/settings/settings-account-card"
import { SettingsHeader } from "@/components/settings/settings-header"
import { SettingsRow } from "@/components/settings/settings-row"
import { useSettings } from "@/data/collections/preferences/settings"
import { useAppVibrate } from "@/hooks/use-app-vibrate"
import { GlobalLoginDrawer } from "@/providers/auth-provider"

export const Route = createFileRoute("/settings")({
  component: SettingsPage,
})

function SettingsPage() {
  const router = useRouter()
  //own the edge-swipe-back only when the OS gesture is neutralised (standalone)
  const isStandalone = useMediaQuery("(display-mode: standalone)")
  const { settings, setSettings } = useSettings()
  const { vibrateOk } = useAppVibrate()
  const { vibrateOk: baseVibrateOk } = useBaseVibrate()
  const [resolvedTheme, toggleTheme] = useTheme()

  function handleDarkModeChange() {
    vibrateOk()
    toggleTheme()
  }

  function handleAnimationsChange(checked: boolean) {
    vibrateOk()
    setSettings({ animations: checked })
  }

  //haptics can't confirm themselves through the app hook once they're off —
  //the base hook fires the tick regardless so the toggle still feels alive
  function handleHapticsChange(checked: boolean) {
    baseVibrateOk()
    setSettings({ haptics: checked })
  }

  return (
    <PageWithSmoothEdges>
      <EdgeSwipeGestures
        enabled={isStandalone}
        left={() => router.navigate({ to: "/" })}
      />
      <SettingsHeader />

      {/* Login drawer rendered here (page/outlet scope) — NOT in AuthProvider —
          so its autofocus can raise the iOS keyboard. See GlobalLoginDrawer. */}
      <GlobalLoginDrawer />

      <SettingsAccountCard />

      <section className="flex flex-col gap-y-2">
        <h2 className="ps-1 text-sm font-medium text-subtle">
          Preferences
        </h2>
        <ul className="flex flex-col overflow-hidden rounded-md bg-surface">
          <SettingsRow
            label="Dark mode"
            icon={Moon}
            checked={resolvedTheme === "dark"}
            onCheckedChange={handleDarkModeChange}
            showSeparator
          />
          <SettingsRow
            label="Animations"
            icon={Sparkles}
            checked={settings.animations}
            onCheckedChange={handleAnimationsChange}
            showSeparator
          />
          <SettingsRow
            label="Haptics"
            icon={Vibrate}
            checked={settings.haptics}
            onCheckedChange={handleHapticsChange}
          />
        </ul>
      </section>
    </PageWithSmoothEdges>
  )
}
