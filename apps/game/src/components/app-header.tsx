import { cn } from "@repo/nativ/utils"
import { Link, useNavigate } from "@tanstack/react-router"
import { useState } from "react"
import { useTranslation } from "react-i18next"
import { AppSettingsSheet } from "@/components/app-settings-sheet"
import {
  ChevronDownIcon,
  LogoutIcon,
  PersonIcon,
  SettingsIcon,
} from "@/components/icons"
import { Logo } from "@/components/logo"
import { Avatar } from "@/components/ui/avatar"
import { Menu, MenuItem, MenuSeparator } from "@/components/ui/menu"
import { NavLink } from "@/components/ui/nav-link"
import { TapButton } from "@/components/ui/tap-button"
import { useProfile } from "@/data/profile/queries"
import { useSignOut } from "@/hooks/use-sign-out"
import { useAuthPrompt } from "@/providers/auth-prompt-provider"
import { useAuth } from "@/providers/auth-provider"
import { needsSignIn } from "@/routing/auth-guard"

/**
 * The gear: the one thing in this bar that is not a place.
 *
 * Nothing here is filled. A filled control in the chrome reads as the page's own
 * action, and the page's action belongs to the page.
 */
const CHROME_BUTTON_CLASS =
  "flex size-[38px] items-center justify-center rounded-[9px] text-muted transition-colors duration-200 ease-out hover:bg-white/10 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand lg:size-10 lg:rounded-[10px]"

/**
 * A destination, spelled out.
 *
 * It runs the full height of the bar rather than sitting as a pill inside it,
 * because the mark of the one you are on is a bar across its bottom edge — and
 * that edge only reads as an edge when it is the window's own.
 */
const NAV_LINK_CLASS =
  "relative flex items-center px-4 font-display text-[15px] font-semibold transition-colors duration-200 ease-out hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-brand"

/**
 * Lit only on the destination you are on. `NavLink` can hand a class to the
 * anchor but not a flag to its children, so the anchor reveals the bar from
 * above rather than the bar asking whether it should be there.
 */
const NAV_LINK_ACTIVE_CLASS =
  "text-white [&_[data-active-bar]]:opacity-100"

/**
 * The bar across the top of every screen.
 *
 * It used to say New game and Rules, which named one of the two ways to play and
 * left the other one to a sheet behind an anonymous square in a tab bar. There
 * is no tab bar now, so this names all three: Play Online, Play Offline, Rules.
 * They are two different routes with two different setups, and the rules sit
 * beside them because a new player needs them before either. Home stays behind
 * the mark, as it always was.
 *
 * What stays in icon form is the gear, because settings are not a place you go.
 *
 * Below `lg` the destinations drop off and this keeps the mark, the gear and the
 * account. A phone reaches the three of them from home, which is the one screen
 * it always has a way back to.
 *
 * The safe padding is on the outer box and the height on the one inside it: with
 * `box-border` a single box would let the height swallow the inset instead of
 * clearing it.
 *
 * The row runs the full width rather than sitting in the page's centred column.
 * A bar is chrome, not content: what it holds are the two far corners of the
 * window, and a max-width would pull them into a huddle in the middle of a wide
 * monitor.
 *
 * `className` is for the layout that mounts it, and in practice for one thing:
 * the board screens hide it below `lg`.
 */
export function AppHeader({ className }: { className?: string }) {
  const { t } = useTranslation()
  const { requireAuth } = useAuthPrompt()
  const [settingsOpen, setSettingsOpen] = useState(false)

  return (
    <header
      className={cn(
        "relative shrink-0 bg-chrome px-safe pt-safe",
        className,
      )}
    >
      <div className="flex h-14 w-full items-center gap-2 px-4 lg:h-17 lg:gap-7 lg:px-7">
        <Link
          to="/"
          className="flex shrink-0 items-center gap-2.5 rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand"
        >
          <Logo className="size-[26px] lg:size-8" />
          <span className="font-display text-lg font-bold tracking-[-0.02em] text-white lg:text-xl">
            Abalone
          </span>
        </Link>

        {/* Above `lg` only. A phone bar with three labels in it has no room
            left for the account, and home is one press away from all three. */}
        <nav
          aria-label={t("common:nav.primary")}
          className="hidden items-stretch gap-0.5 self-stretch lg:flex"
        >
          {/* The one destination that needs an account, so it asks for one
              here rather than sending a guest to a page that would send them
              straight back with the same form on top of it. It asks the
              question `SignedInOnly` asks, so the two can never disagree.

              Still a link: it can be copied, opened in its own tab, and it
              lights up like the other two when you are on it. Only a plain
              press is taken over, and a modifier press is left alone — that
              tab can do its own asking. */}
          <NavLink
            to="/online"
            className={NAV_LINK_CLASS}
            activeClassName={NAV_LINK_ACTIVE_CLASS}
            inactiveClassName="text-muted"
            onClick={(event) => {
              if (!needsSignIn()) return
              if (event.metaKey || event.ctrlKey || event.shiftKey) return
              event.preventDefault()
              requireAuth({ redirect: "/online" })
            }}
          >
            {t("common:nav.online")}
            <ActiveBar />
          </NavLink>

          <NavLink
            to="/offline"
            className={NAV_LINK_CLASS}
            activeClassName={NAV_LINK_ACTIVE_CLASS}
            inactiveClassName="text-muted"
          >
            {t("common:nav.offline")}
            <ActiveBar />
          </NavLink>

          <NavLink
            to="/rules"
            className={NAV_LINK_CLASS}
            activeClassName={NAV_LINK_ACTIVE_CLASS}
            inactiveClassName="text-muted"
          >
            {t("common:nav.rules")}
            <ActiveBar />
          </NavLink>
        </nav>

        <div className="ms-auto flex items-center gap-2">
          <button
            type="button"
            aria-label={t("game:controls.settings")}
            title={t("game:controls.settings")}
            className={CHROME_BUTTON_CLASS}
            onClick={() => setSettingsOpen(true)}
          >
            <SettingsIcon size={20} />
          </button>

          <AccountControl />
        </div>
      </div>

      {/* A hairline the bar draws rather than a border on the box: the safe-area
          padding is on that same box, so a border would land below the inset
          instead of under the row. */}
      <span
        aria-hidden="true"
        className="pointer-events-none absolute inset-x-0 bottom-0 h-px bg-border-subtle"
      />

      <AppSettingsSheet
        open={settingsOpen}
        onClose={() => setSettingsOpen(false)}
      />
    </header>
  )
}

/**
 * The mark on the destination you are on: a bar along the bottom of it, sitting
 * on the header's own edge, which is the edge the chrome shares with the page.
 */
function ActiveBar() {
  return (
    <span
      aria-hidden="true"
      data-active-bar
      className="pointer-events-none absolute inset-x-2 bottom-0 h-0.5 bg-brand opacity-0 transition-opacity duration-200 ease-out"
    />
  )
}

const ACCOUNT_BUTTON_CLASS =
  "h-9 gap-2 rounded-[9px] bg-surface ps-1.5 pe-2.5 font-display text-sm font-semibold text-white hover:bg-surface-2 lg:h-10 lg:gap-2.5 lg:rounded-[10px] lg:pe-3"

/**
 * Who you are, in the corner.
 *
 * Signing in is an overlay rather than a screen, so this asks in place: whatever
 * you were reading stays behind the form, and pressing it costs you nothing if
 * you change your mind.
 *
 * Above `lg` the caret opens the account: the profile, the record, and the way
 * out. Below it the same button goes straight to `/profile`, because every row
 * that menu holds is on that page anyway, and a menu hanging off a 56px bar is
 * a target the thumb shares with the edge of the screen.
 */
function AccountControl() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const { user } = useAuth()
  const { data: profile } = useProfile()
  const { requireAuth } = useAuthPrompt()
  const signOut = useSignOut()

  //a word, not a square. it is the one thing in this bar somebody arrives
  //looking for, and an icon is the wrong shape for something looked for by name
  if (!user) {
    return (
      <TapButton
        onClick={() => requireAuth({})}
        className="inline-flex h-[38px] items-center rounded-[9px] bg-surface px-3.5 font-display text-sm font-semibold text-white transition-colors duration-200 ease-out hover:bg-surface-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand lg:h-10 lg:rounded-[10px] lg:bg-transparent lg:px-4 lg:text-[15px] lg:text-subtle lg:hover:bg-white/10 lg:hover:text-white"
      >
        {t("common:auth.sign_in")}
      </TapButton>
    )
  }

  const face = (
    <>
      <Avatar
        src={profile?.avatarUrl}
        name={user.displayUsername}
        size={28}
      />
      <span className="max-w-35 truncate">{user.displayUsername}</span>
    </>
  )

  return (
    <>
      <TapButton
        aria-label={t("common:nav.profile")}
        onClick={() => navigate({ to: "/profile" })}
        className={cn(
          "flex items-center transition-colors duration-200 ease-out focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand lg:hidden",
          ACCOUNT_BUTTON_CLASS,
        )}
      >
        {face}
      </TapButton>

      <Menu
        className="hidden lg:block"
        align="end"
        ariaLabel={t("common:nav.profile")}
        triggerClassName={ACCOUNT_BUTTON_CLASS}
        label={
          <>
            {face}
            <ChevronDownIcon size={16} className="opacity-50" />
          </>
        }
      >
        <MenuItem
          icon={PersonIcon}
          onSelect={() => navigate({ to: "/profile" })}
        >
          {t("common:nav.profile")}
        </MenuItem>
        <MenuSeparator />
        <MenuItem
          icon={LogoutIcon}
          className="text-loss hover:bg-loss/15 hover:text-loss"
          onSelect={() => signOut.mutate()}
        >
          {t("common:auth.sign_out")}
        </MenuItem>
      </Menu>
    </>
  )
}
