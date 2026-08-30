import { Screen, ScrollView } from "@repo/nativ/components"
import { cn } from "@repo/nativ/utils"
import { useQuery } from "@tanstack/react-query"
import { createFileRoute, Link } from "@tanstack/react-router"
import type { ReactNode } from "react"
import { useState } from "react"
import { useTranslation } from "react-i18next"
import { AppSettingsSheet } from "@/components/app-settings-sheet"
import {
  CameraIcon,
  ChevronRightIcon,
  HistoryIcon,
  ImageIcon,
  LogoutIcon,
  SettingsIcon,
} from "@/components/icons"
import { Avatar } from "@/components/ui/avatar"
import { Panel } from "@/components/ui/panel"
import { SubpageHeader } from "@/components/ui/subpage-header"
import { TapButton } from "@/components/ui/tap-button"
import { gamesQueryOptions } from "@/data/online/queries"
import { useProfile } from "@/data/profile/queries"
import {
  ACCEPTED_IMAGES,
  useAvatarPicker,
} from "@/hooks/use-avatar-picker"
import { useSignOut } from "@/hooks/use-sign-out"
import { useAuth } from "@/providers/auth-provider"
import { SignedInOnly } from "@/routing/signed-in-only"
import { profileStatsOf } from "@/utils/profile-stats"

export const Route = createFileRoute("/_subpage/profile")({
  component: GuardedProfilePage,
})

function GuardedProfilePage() {
  return (
    <SignedInOnly returnTo="/">
      <ProfilePage />
    </SignedInOnly>
  )
}

const ROW_CLASS =
  "flex w-full items-center gap-3.5 px-5 py-4 text-left transition-colors duration-200 ease-out hover:bg-surface-2 focus-visible:outline-none focus-visible:bg-surface-2"

/**
 * The account, as a page.
 *
 * It used to be a drawer with two buttons in it, on the grounds that a name you
 * cannot change plus a picture you can is a menu's worth of content. What that
 * missed is the record: how many games you have played out, how many you won,
 * how many are open right now. Those are the reason to look at yourself at all,
 * and none of them fit in a drawer that has to be dismissed to use anything.
 *
 * The picture is changed by pressing the picture. A row labelled "Change
 * picture" underneath the thing it changes is a caption pretending to be a
 * control, and on a phone the avatar is already the biggest target on screen.
 */
function ProfilePage() {
  const { t } = useTranslation()
  const { user } = useAuth()
  const { data: profile } = useProfile()
  const picker = useAvatarPicker()
  const signOut = useSignOut()
  const [settingsOpen, setSettingsOpen] = useState(false)

  //the two lists the numbers are counted from. both are already in cache for
  //anyone who has opened the hub, so this page usually paints its record from
  //the first frame and refreshes it underneath.
  const finished = useQuery(gamesQueryOptions("finished"))
  const active = useQuery(gamesQueryOptions("active"))

  const stats = profileStatsOf(
    finished.data ?? [],
    active.data ?? [],
    user?.id ?? "",
  )

  const isBusy = picker.isUploading || signOut.isPending

  return (
    <>
      <SubpageHeader title={t("common:nav.profile")} />

      <Screen>
        <ScrollView className="px-safe" directionalLockEnabled>
          <div className="mx-auto flex w-full max-w-[820px] flex-col gap-4 px-3.5 pt-5 pb-safe-offset-10 lg:gap-6 lg:px-12 lg:pt-11">
            {/* The input is the control; everything visible is what it looks
                like. A bare file input cannot be styled and reads as a form
                field rather than as the one thing here you can change. */}
            <input
              ref={picker.inputRef}
              type="file"
              accept={ACCEPTED_IMAGES}
              className="hidden"
              onChange={picker.handleChange}
            />

            <Identity
              avatarUrl={profile?.avatarUrl}
              name={user?.displayUsername ?? ""}
              isBusy={isBusy}
              isUploading={picker.isUploading}
              onPickPicture={picker.open}
            />

            {picker.hasFailed && (
              <p role="alert" className="text-sm text-loss">
                {t("common:profile.upload_failed")}
              </p>
            )}

            <Panel className="flex">
              <Stat
                value={stats.played}
                label={t("online:history.played")}
              />
              <Stat
                value={stats.won}
                label={t("online:history.won")}
                tone="brand"
              />
              <Stat
                value={stats.playing}
                label={t("common:profile.playing")}
              />
              {/* The fourth number needs the room a phone does not have, and it
                  is the least of the four: a record of a record. */}
              <Stat
                value={stats.bestStreak}
                label={t("common:profile.best_streak")}
                className="max-lg:hidden"
              />
            </Panel>

            <Panel>
              <Link
                to="/online/history"
                search={{ page: 1 }}
                className={cn(ROW_CLASS, "max-lg:hidden")}
              >
                <HistoryIcon
                  size={19}
                  className="shrink-0 text-white/40"
                />
                <RowLabel
                  title={t("online:history.heading")}
                  detail={t("common:profile.history_hint")}
                />
                <ChevronRightIcon
                  size={18}
                  className="shrink-0 text-white/25"
                />
              </Link>

              <span
                aria-hidden="true"
                className="block h-px bg-border-subtle max-lg:hidden"
              />

              <TapButton
                onClick={() => setSettingsOpen(true)}
                className={ROW_CLASS}
              >
                <SettingsIcon
                  size={19}
                  className="shrink-0 text-white/40"
                />
                <RowLabel
                  title={t("game:controls.settings")}
                  detail={t("common:profile.settings_hint")}
                />
                <ChevronRightIcon
                  size={18}
                  className="shrink-0 text-white/25"
                />
              </TapButton>
            </Panel>

            {/* Its own panel, and that is the whole point of it: a third row in
                the list above would read as a third place to go. */}
            <Panel>
              <TapButton
                disabled={isBusy}
                onClick={() => signOut.mutate()}
                className={cn(ROW_CLASS, "text-loss hover:bg-loss/10")}
              >
                <LogoutIcon size={19} className="shrink-0" />
                <span className="min-w-0 flex-1 font-display text-[15px] font-semibold">
                  {t("common:auth.sign_out")}
                </span>
              </TapButton>
            </Panel>
          </div>
        </ScrollView>
      </Screen>

      <AppSettingsSheet
        open={settingsOpen}
        onClose={() => setSettingsOpen(false)}
      />
    </>
  )
}

type IdentityProps = {
  avatarUrl?: string | null
  name: string
  isBusy: boolean
  isUploading: boolean
  onPickPicture: () => void
}

/**
 * The face and the name.
 *
 * On a phone the avatar carries a camera badge and is itself the button. Above
 * `lg` there is room for a labelled one beside the name, and a pointer has no
 * way of discovering that a picture is pressable.
 */
function Identity({
  avatarUrl,
  name,
  isBusy,
  isUploading,
  onPickPicture,
}: IdentityProps) {
  const { t } = useTranslation()

  return (
    <div className="flex flex-col items-center gap-3 pt-2 lg:flex-row lg:gap-6 lg:pt-0">
      <TapButton
        disabled={isBusy}
        onClick={onPickPicture}
        aria-label={t("common:profile.change_picture")}
        className="relative shrink-0 rounded-[21px] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand lg:pointer-events-none lg:rounded-3xl"
      >
        <Avatar
          src={avatarUrl}
          name={name}
          size={84}
          className="lg:size-24"
        />
        {/* Outlined in the page's own colour rather than bordered, so it reads
            as cut out of the picture instead of stuck on top of it. */}
        <span
          aria-hidden="true"
          className="absolute -right-1 -bottom-1 flex size-[34px] items-center justify-center rounded-full bg-brand text-white outline-[3px] outline-ground lg:hidden"
        >
          <CameraIcon size={17} />
        </span>
      </TapButton>

      <div className="flex min-w-0 flex-col items-center lg:flex-1 lg:items-start">
        <h1 className="max-w-full truncate font-display text-2xl font-bold tracking-[-0.02em] text-white lg:text-[34px] lg:font-extrabold lg:tracking-[-0.03em]">
          {name}
        </h1>
        <p className="mt-1.5 text-sm text-faint">
          {t("common:profile.username_permanent")}
        </p>
      </div>

      <TapButton
        disabled={isBusy}
        onClick={onPickPicture}
        className="hidden h-11 shrink-0 items-center gap-2.5 rounded-[11px] bg-surface px-[18px] font-display text-[15px] font-semibold text-white transition-colors duration-200 ease-out hover:bg-surface-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand lg:flex"
      >
        <ImageIcon size={19} />
        {isUploading && t("common:profile.uploading")}
        {!isUploading && t("common:profile.change_picture")}
      </TapButton>
    </div>
  )
}

type StatProps = {
  value: number
  label: string
  tone?: "plain" | "brand"
  className?: string
}

/** One cell of the record. The rule is on the left, so the first has none. */
function Stat({ value, label, tone = "plain", className }: StatProps) {
  return (
    <div
      className={cn(
        "flex flex-1 flex-col items-center gap-1 border-border-subtle border-s py-4 first:border-s-0 lg:py-[22px]",
        className,
      )}
    >
      <span
        className={cn(
          "font-display font-bold text-[22px] tabular-nums lg:text-[28px]",
          tone === "plain" && "text-white",
          tone === "brand" && "text-brand-lighter",
        )}
      >
        {value}
      </span>
      <span className="section-label">{label}</span>
    </div>
  )
}

function RowLabel({
  title,
  detail,
}: {
  title: string
  detail: ReactNode
}) {
  return (
    <span className="min-w-0 flex-1">
      <span className="block truncate font-display text-[15px] font-semibold text-white">
        {title}
      </span>
      <span className="mt-px block truncate text-[13px] text-faint">
        {detail}
      </span>
    </span>
  )
}
