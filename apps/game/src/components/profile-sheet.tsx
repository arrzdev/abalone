import { useTranslation } from "react-i18next"
import { ImageIcon, LogoutIcon } from "@/components/icons"
import { Avatar } from "@/components/ui/avatar"
import { Button } from "@/components/ui/button"
import { Sheet } from "@/components/ui/sheet"
import { useProfile } from "@/data/profile/queries"
import {
  ACCEPTED_IMAGES,
  useAvatarPicker,
} from "@/hooks/use-avatar-picker"
import { useSignOut } from "@/hooks/use-sign-out"
import { useAuth } from "@/providers/auth-provider"

export type ProfileSheetProps = {
  open: boolean
  onClose: () => void
}

/**
 * The account, as a drawer — the phone's half of what the header menu is on a
 * desktop.
 *
 * There is no account *page* anywhere in the app, and this is why: everything an
 * account holds here is a name you cannot change, a picture you can, and the way
 * out. That is a menu's worth of content, and a whole screen built around it is
 * a screen whose only job is to be navigated away from.
 */
export function ProfileSheet({ open, onClose }: ProfileSheetProps) {
  const { t } = useTranslation()
  const { user } = useAuth()
  const { data: profile } = useProfile()
  const picker = useAvatarPicker()
  const signOut = useSignOut()

  const isBusy = picker.isUploading || signOut.isPending

  return (
    <Sheet open={open} onClose={onClose} title={t("common:nav.profile")}>
      <div className="flex flex-col gap-y-5">
        <div className="flex items-center gap-4">
          <Avatar
            src={profile?.avatarUrl}
            size={64}
            className="rounded-2xl"
          />

          <div className="min-w-0 flex-1">
            <p className="truncate text-lg font-bold text-white">
              {user?.displayUsername}
            </p>
            <p className="mt-0.5 text-xs text-faint">
              {t("common:profile.username_permanent")}
            </p>
          </div>
        </div>

        {/* The input is the control; the button is what it looks like. A bare
            file input cannot be styled and reads as a form field rather than as
            the one thing on here you can actually change. */}
        <input
          ref={picker.inputRef}
          type="file"
          accept={ACCEPTED_IMAGES}
          className="hidden"
          onChange={picker.handleChange}
        />

        <div className="flex flex-col gap-y-2">
          <Button
            variant="outline"
            size="lg"
            className="w-full"
            disabled={isBusy}
            onClick={picker.open}
          >
            <ImageIcon size={20} />
            {picker.isUploading && t("common:profile.uploading")}
            {!picker.isUploading && t("common:profile.change_picture")}
          </Button>

          <p className="text-center text-xs text-faint">
            {t("common:profile.picture_hint")}
          </p>

          {picker.hasFailed && (
            <p role="alert" className="text-center text-xs text-loss">
              {t("common:profile.upload_failed")}
            </p>
          )}
        </div>

        <Button
          variant="ghost"
          size="lg"
          className="w-full text-loss hover:bg-loss/10 hover:text-loss"
          disabled={isBusy}
          onClick={() => {
            onClose()
            signOut.mutate()
          }}
        >
          <LogoutIcon size={20} />
          {t("common:auth.sign_out")}
        </Button>
      </div>
    </Sheet>
  )
}
