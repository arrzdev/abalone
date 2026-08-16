import { cn } from "@repo/nativ/utils"
import { Link, useMatchRoute } from "@tanstack/react-router"
import { useState } from "react"
import { useTranslation } from "react-i18next"
import { AppSettingsSheet } from "@/components/app-settings-sheet"
import {
  ChevronDownIcon,
  ImageIcon,
  LogoutIcon,
  SettingsIcon,
} from "@/components/icons"
import { Logo } from "@/components/logo"
import { Avatar } from "@/components/ui/avatar"
import { Menu, MenuItem, MenuSeparator } from "@/components/ui/menu"
import { NavLink } from "@/components/ui/nav-link"
import { useProfile } from "@/data/profile/queries"
import {
  ACCEPTED_IMAGES,
  useAvatarPicker,
} from "@/hooks/use-avatar-picker"
import { useSignOut } from "@/hooks/use-sign-out"
import { useAuth } from "@/providers/auth-provider"

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
 * because the mark of the one you are on is a bar across its top edge — and that
 * edge only reads as an edge when it is the window's own.
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
 * The bar across the top of every screen inside the shell.
 *
 * It used to be the mark and three anonymous squares. Three squares say there
 * are three things up here and nothing about what any of them is, so this one
 * spells its destinations out instead: New game, Rules, and home behind the mark
 * as it always was. What stays in icon form is the gear, because settings are
 * not a place you go.
 *
 * Below `lg` the destinations move to the tab bar and this keeps only the mark,
 * the gear, and — signed out — the way in.
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

        {/* Above `lg` only: below it these are the tab bar, and a window that
            said them twice would be offering two navigations. */}
        <nav
          aria-label={t("common:nav.primary")}
          className="hidden items-stretch gap-0.5 self-stretch lg:flex"
        >
          <NavLink
            to="/game/offline"
            className={NAV_LINK_CLASS}
            activeClassName={NAV_LINK_ACTIVE_CLASS}
            inactiveClassName="text-muted"
          >
            {t("common:nav.new_game")}
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
 * on the header's own edge.
 *
 * The tab bar below `lg` puts its copy on top, and the difference is not an
 * inconsistency — each one hangs off the edge the chrome shares with the page,
 * so the mark always points at the content it belongs to. A bar is at the top of
 * a bar docked to the bottom of the screen, and at the bottom of one docked to
 * the top of it.
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

/**
 * Who you are, in the corner, and the whole of the account on a desktop.
 *
 * Signing in comes back to whichever page you were on rather than to an account
 * screen: it is always something you started doing for a reason.
 *
 * The menu hides below `lg`, where the Profile tab is the way to all of this.
 */
function AccountControl() {
  const { t } = useTranslation()
  const { user } = useAuth()
  const { data: profile } = useProfile()
  const picker = useAvatarPicker()
  const signOut = useSignOut()
  const matchRoute = useMatchRoute()

  //nothing to offer on the login screen: signed out this is a way to the page
  //already open, and signed in the route sends you home before it renders
  if (matchRoute({ to: "/login" })) return null

  //a word, not a square. it is the one thing in this bar somebody arrives
  //looking for, and an icon is the wrong shape for something looked for by name
  if (!user) {
    return (
      <Link
        to="/login"
        search={{ redirect: "/" }}
        className="inline-flex h-[38px] items-center rounded-[9px] bg-surface px-3.5 font-display text-sm font-semibold text-white transition-colors duration-200 ease-out hover:bg-surface-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand lg:h-10 lg:rounded-[10px] lg:bg-transparent lg:px-4 lg:text-[15px] lg:text-subtle lg:hover:bg-white/10 lg:hover:text-white"
      >
        {t("common:auth.sign_in")}
      </Link>
    )
  }

  return (
    <>
      <input
        ref={picker.inputRef}
        type="file"
        accept={ACCEPTED_IMAGES}
        className="hidden"
        onChange={picker.handleChange}
      />

      <Menu
        className="hidden lg:block"
        align="end"
        ariaLabel={t("common:nav.profile")}
        triggerClassName="h-10 gap-2.5 rounded-[10px] bg-surface ps-1.5 pe-3 font-display text-sm font-semibold hover:bg-surface-2"
        label={
          <>
            <Avatar
              src={profile?.avatarUrl}
              name={user.displayUsername}
              size={28}
            />
            <span className="max-w-35 truncate">
              {user.displayUsername}
            </span>
            <ChevronDownIcon size={16} className="opacity-50" />
          </>
        }
      >
        <MenuItem icon={ImageIcon} onSelect={picker.open}>
          {picker.isUploading && t("common:profile.uploading")}
          {!picker.isUploading && t("common:profile.change_picture")}
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
