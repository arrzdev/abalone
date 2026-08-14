import { cn } from "@repo/nativ/utils"
import { Link } from "@tanstack/react-router"
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
  "flex h-9 w-9 items-center justify-center rounded-lg text-white/60 transition-colors duration-200 ease-out hover:bg-white/10 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand"

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
 * `className` is for the layout that mounts it, and in practice for one thing:
 * the board screens hide it below `lg`.
 */
export function AppHeader({ className }: { className?: string }) {
  const { t } = useTranslation()
  const [settingsOpen, setSettingsOpen] = useState(false)

  return (
    <header
      className={cn(
        "relative shrink-0 border-b border-white/5 bg-surface-2 px-safe pt-safe",
        className,
      )}
    >
      <div className="mx-auto flex h-14 w-full max-w-5xl items-center gap-2 px-4 lg:gap-6">
        <Link
          to="/"
          className="flex shrink-0 items-center gap-2 rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand"
        >
          <Logo className="h-7 w-7" />
          <span className="text-lg font-extrabold tracking-tight text-white">
            Abalone
          </span>
        </Link>

        <div className="ms-auto flex items-center gap-1 lg:gap-2">
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
            <HelpIcon size={20} />
          </NavLink>

          <button
            type="button"
            aria-label={t("game:controls.settings")}
            title={t("game:controls.settings")}
            className={ICON_BUTTON_CLASS}
            onClick={() => setSettingsOpen(true)}
          >
            <SettingsIcon size={20} />
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
        <PersonIcon size={20} />
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
        triggerClassName={cn("gap-2 ps-1.5 pe-2")}
        label={
          <>
            <Avatar
              src={profile?.avatarUrl}
              size={26}
              className="rounded-md"
            />
            <span className="max-w-32 truncate">
              {user.displayUsername}
            </span>
            <ChevronDownIcon size={16} className="opacity-60" />
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
