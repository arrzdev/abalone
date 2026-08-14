import { useState } from "react"
import { useTranslation } from "react-i18next"
import { HomeIcon, PersonIcon, PlayIcon } from "@/components/icons"
import { PlaySheet } from "@/components/play-sheet"
import { ProfileSheet } from "@/components/profile-sheet"
import { NavLink } from "@/components/ui/nav-link"
import { TapButton } from "@/components/ui/tap-button"
import { useAuthPrompt } from "@/providers/auth-prompt-provider"

/**
 * One tab: grey, and whiter when it is the one you are on.
 *
 * Nothing here is filled or tinted. A tab bar is read at a glance and there are
 * only three of them, so brightness carries it — a coloured pill under one icon
 * reads as a button someone dropped into the row.
 *
 * `aria-expanded` covers the two that open a sheet: they are never "active" in
 * the router's sense, but while their sheet is up they are what you pressed.
 */
const TAB_CLASS =
  "flex min-w-0 flex-1 flex-col items-center gap-1.5 rounded-lg py-2 text-white/45 transition-colors duration-200 ease-out data-[status=active]:text-white aria-expanded:text-white"

/**
 * `leading-4`, never `leading-none`: `truncate` brings `overflow: hidden` with
 * it, and a line box the exact height of the font clips every descender inside
 * it. "Jogar" loses the tail of its g.
 */
const LABEL_CLASS =
  "max-w-full truncate text-[11px] leading-4 font-semibold"

/**
 * The mobile chrome, and above `lg` the header's job instead.
 *
 * Only one of the three is a destination. Play and Profile both open a sheet,
 * because what is behind each of them is a short list rather than a screen: the
 * choice of opponent, and an account that is a name, a picture and the way out.
 * Sending someone to a page for either would be a page they immediately leave.
 *
 * `pb-safe-or-2` rather than `pb-safe`: the bare inset collapses to zero on
 * Android standalone and in a desktop browser, which would leave the row sitting
 * on the very edge. This component takes no `className` on purpose — that
 * padding is not one of `cn`'s merge groups, so a caller passing `pb-*` would
 * get both classes rather than an override.
 */
export function AppTabBar() {
  const { t } = useTranslation()
  const { requireAuth } = useAuthPrompt()
  const [playOpen, setPlayOpen] = useState(false)
  const [profileOpen, setProfileOpen] = useState(false)

  return (
    <nav
      aria-label={t("common:nav.primary")}
      className="relative shrink-0 border-t border-white/5 bg-surface-2 px-safe pb-safe-or-2 lg:hidden"
    >
      <div className="flex items-stretch justify-around gap-1 px-2 pt-1.5">
        <NavLink to="/" exact className={TAB_CLASS}>
          <HomeIcon size={22} />
          <span className={LABEL_CLASS}>{t("common:nav.home")}</span>
        </NavLink>

        <TapButton
          aria-haspopup="dialog"
          aria-expanded={playOpen}
          className={TAB_CLASS}
          onClick={() => setPlayOpen(true)}
        >
          <PlayIcon size={22} />
          <span className={LABEL_CLASS}>{t("common:nav.play")}</span>
        </TapButton>

        {/* Signed out this opens the form instead, and the account drawer after
            it — the tab means "me" either way. */}
        <TapButton
          aria-haspopup="dialog"
          aria-expanded={profileOpen}
          className={TAB_CLASS}
          onClick={() =>
            requireAuth({ onSuccess: () => setProfileOpen(true) })
          }
        >
          <PersonIcon size={22} />
          <span className={LABEL_CLASS}>{t("common:nav.profile")}</span>
        </TapButton>
      </div>

      <PlaySheet open={playOpen} onClose={() => setPlayOpen(false)} />
      <ProfileSheet
        open={profileOpen}
        onClose={() => setProfileOpen(false)}
      />
    </nav>
  )
}
