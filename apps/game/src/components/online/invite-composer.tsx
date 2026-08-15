import type { PlayableSetup } from "@repo/abalone-engine/board-setups"
import {
  DEFAULT_SETUP,
  isPlayableSetup,
} from "@repo/abalone-engine/board-setups"
import { useId, useState } from "react"
import { useTranslation } from "react-i18next"
import type { ColorChoiceValue } from "@/components/color-choice"
import { ColorChoice } from "@/components/color-choice"
import { SetupCarousel } from "@/components/setup-carousel"
import { Button } from "@/components/ui/button"
import { Sheet } from "@/components/ui/sheet"
import { TextField } from "@/components/ui/text-field"
import type { SendInviteInput } from "@/data/online/mutations"

export type InviteComposerProps = {
  open: boolean
  onClose: () => void
  onSend: (input: SendInviteInput) => void
  pending: boolean
  /** What went wrong last time, already translated. */
  error?: string
}

/**
 * Asking somebody to play, in the shape the pregame panel already uses.
 *
 * The setup carousel and the side picker are the offline panel's own controls,
 * so the two ways into a game ask the same questions in the same order. The one
 * thing this adds is who you are asking.
 */
export function InviteComposer({
  open,
  onClose,
  onSend,
  pending,
  error,
}: InviteComposerProps) {
  const { t } = useTranslation()
  const errorId = useId()
  const [username, setUsername] = useState("")
  const [setupType, setSetupType] = useState<PlayableSetup>(DEFAULT_SETUP)
  const [side, setSide] = useState<ColorChoiceValue>("random")

  const handle = username.trim()

  return (
    <Sheet
      open={open}
      onClose={onClose}
      title={t("online:compose.title")}
      description={t("online:compose.body")}
      footer={
        <Button
          variant="primary"
          size="lg"
          className="w-full"
          disabled={pending || handle.length < 3}
          onClick={() => onSend({ username: handle, setupType, side })}
        >
          {pending
            ? t("online:compose.sending")
            : t("online:compose.send")}
        </Button>
      }
    >
      <div className="flex flex-col gap-y-5">
        <div>
          <TextField
            label={t("online:compose.username")}
            placeholder={t("online:compose.username_placeholder")}
            value={username}
            onChange={(event) => setUsername(event.target.value)}
            autoComplete="off"
            autoCapitalize="none"
            autoCorrect="off"
            spellCheck={false}
            maxLength={20}
            invalid={Boolean(error)}
            describedBy={error ? errorId : undefined}
          />

          {/* The name is the only thing here that can be wrong, so the line
              belongs to it rather than to the sheet. No reserved slot: the send
              button sits in the footer and does not move, so appearing costs a
              nudge of the carousel and nothing that is under a thumb. */}
          {error && (
            <p
              id={errorId}
              role="alert"
              className="mt-2 text-sm leading-5 text-loss"
            >
              {error}
            </p>
          )}
        </div>

        <div>
          <p className="mb-2 text-sm font-semibold text-subtle">
            {t("online:compose.setup")}
          </p>
          {/* the carousel is typed on every setup there is, and only ever
              offers the playable ones. the guard is what says so out loud. */}
          <SetupCarousel
            setupType={setupType}
            onChange={(next) => {
              if (isPlayableSetup(next)) setSetupType(next)
            }}
          />
        </div>

        <div>
          <p className="mb-2 text-sm font-semibold text-subtle">
            {t("online:compose.side")}
          </p>
          <ColorChoice value={side} onChange={setSide} />
        </div>
      </div>
    </Sheet>
  )
}
