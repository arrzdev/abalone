import { cn } from "@repo/nativ/utils"
import { Link, useMatchRoute } from "@tanstack/react-router"
import { useState } from "react"
import { useTranslation } from "react-i18next"
import { AppSettingsSheet } from "@/components/app-settings-sheet"
import {
  ChevronDownIcon,
  HelpIcon,
  ImageIcon,
  LogoutIcon,
  PersonIcon,
  SettingsIcon,
} from "@/components/icons"
import { LanguageSwitcher } from "@/components/language-switcher"
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

const ICON_BUTTON_CLASS =
  "flex size-10 items-center justify-center rounded-lg text-muted transition-colors duration-200 ease-out hover:bg-white/10 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand lg:size-11 lg:rounded-xl"

//the desktop step has to be a class: Lucide's `size` lands as width/height
//presentation attributes, which any CSS rule outranks
const ICON_GLYPH_CLASS = "lg:size-6"

/**
 * The bar across the top of every screen inside the shell.
 *
 * The mark on one side and a row of square icons on the other, at every width.
 * There are no words in it: the destinations live in the tab bar below `lg`, and
 * everything up here is the same kind of thing, so rules, settings, language and
 * the account all get the same square. A phone keeps the row for the same
 * reason it exists at all, since the tab bar has no room for any of them.
 *
 * The safe padding is on the outer box and the height on the one inside it: with
 * `box-border` a single box would let `h-14` swallow the inset instead of
 * clearing it.
 *
 * The row runs the full width rather than sitting in the page's centred column.
 * A bar is chrome, not content: what it holds are the two far corners of the
 * window, and a max-width would pull them into a huddle in the middle of a wide
 * monitor. Everything in it steps up a size above `lg`, where the bar stops
 * competing with the screen for room.
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
        "relative shrink-0 border-b border-border-subtle bg-surface-2 px-safe pt-safe",
        className,
      )}
    >
      <div className="flex h-14 w-full items-center gap-2 px-4 lg:h-18 lg:gap-6 lg:px-8">
        <Link
          to="/"
          className="flex shrink-0 items-center gap-2 rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand lg:gap-3"
        >
          <Logo className="size-7 lg:size-9" />
          <span className="text-lg font-extrabold tracking-tight text-white lg:text-2xl">
            Abalone
          </span>
        </Link>

        <div className="ms-auto flex items-center gap-1 lg:gap-1.5">
          {/* The rules, as a question mark rather than a labelled destination.
              It is the one thing on this bar somebody looks for by not knowing
              something, which is what that mark means everywhere else. */}
          <NavLink
            to="/rules"
            aria-label={t("common:nav.rules")}
            title={t("common:nav.rules")}
            className={ICON_BUTTON_CLASS}
            //no fill while on /rules: the fill is how the tab bar says "you are
            //here", and a lit-up square in a row of chrome icons reads as a
            //control that is switched on rather than a page you are on
            activeClassName="text-white"
          >
            <HelpIcon size={20} className={ICON_GLYPH_CLASS} />
          </NavLink>

          <button
            type="button"
            aria-label={t("game:controls.settings")}
            title={t("game:controls.settings")}
            className={ICON_BUTTON_CLASS}
            onClick={() => setSettingsOpen(true)}
          >
            <SettingsIcon size={20} className={ICON_GLYPH_CLASS} />
          </button>

          <LanguageSwitcher />

          <AccountControl />
        </div>
      </div>

      <AppSettingsSheet
        open={settingsOpen}
        onClose={() => setSettingsOpen(false)}
      />
    </header>
  )
}

/**
 * Who you are, in the corner, and the whole of the account on a desktop.
 *
 * There is no profile page up here: everything one would hold is already in this
 * bar, so the menu is the screen. Signing in comes back to whichever page you
 * were on rather than to an account screen, for the same reason.
 *
 * It hides below `lg`, where the Profile tab is the way to all of this.
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

  //the same square as the rest of the bar, not a labelled button: signing in is
  //one of the things this row offers rather than the thing it is for, and a
  //filled pill at the end of four icons reads as the page's main action
  if (!user) {
    return (
      <Link
        to="/login"
        search={{ redirect: "/" }}
        aria-label={t("common:auth.sign_in")}
        title={t("common:auth.sign_in")}
        className={cn(ICON_BUTTON_CLASS, "hidden lg:flex")}
      >
        <PersonIcon size={20} className={ICON_GLYPH_CLASS} />
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
        triggerClassName={cn("h-11 gap-2 rounded-xl ps-2 pe-3 text-base")}
        label={
          <>
            <Avatar
              src={profile?.avatarUrl}
              size={30}
              className="rounded-md"
            />
            <span className="max-w-40 truncate">
              {user.displayUsername}
            </span>
            <ChevronDownIcon size={18} className="opacity-60" />
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
