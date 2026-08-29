import type { PlayableSetup } from "@repo/abalone-engine/board-setups"
import {
  DEFAULT_SETUP,
  isPlayableSetup,
} from "@repo/abalone-engine/board-setups"
import { createGameState } from "@repo/abalone-engine/game-state"
import { useId, useMemo, useState } from "react"
import { useTranslation } from "react-i18next"
import type { ColorChoiceValue } from "@/components/color-choice"
import { ColorChoice } from "@/components/color-choice"
import { GameCanvas } from "@/components/game-canvas"
import { SetupCarousel } from "@/components/setup-carousel"
import { Button } from "@/components/ui/button"
import { Sheet } from "@/components/ui/sheet"
import { TextField } from "@/components/ui/text-field"
import type { SendInviteInput } from "@/data/online/mutations"
import { useMarbleDesign } from "@/hooks/use-marble-design"

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
 *
 * The name is a field and nothing else. There is no lookup in front of it, no
 * "player found" card, no second picture of somebody you just named — you type
 * a name and press send, and the only thing that can come back is that nobody
 * is called that. A search that runs on every keystroke to confirm a name you
 * already know is a request per letter for a fact you learn anyway.
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
  const [marbleDesign] = useMarbleDesign()
  const [username, setUsername] = useState("")
  const [setupType, setSetupType] = useState<PlayableSetup>(DEFAULT_SETUP)
  const [side, setSide] = useState<ColorChoiceValue>("random")

  const handle = username.trim()

  //the opening position and nothing after it, so stepping through the setups
  //costs one board rather than one board per press
  const preview = useMemo(
    () => createGameState(setupType, "black", "local"),
    [setupType],
  )

  return (
    <Sheet
      open={open}
      onClose={onClose}
      title={t("online:compose.title")}
      description={t("online:compose.body")}
      className="lg:max-w-[476px]"
      footer={
        <Button
          variant="primary"
          size="lg"
          className="w-full"
          //an empty field is the only thing this can rule out on its own. how
          //short a name may be is the server's rule, and pre-empting it here
          //means a button that will not press and will not say why
          disabled={pending || handle.length === 0}
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
            prefix="@"
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
              belongs to it rather than to the sheet.

              Two lines of it, always in the layout. What can land here is
              anything the server says about a name, and a message that arrives
              into no space of its own pushes the board preview down and grows
              the sheet — a press on Send that moves the thing under the thumb. */}
          <p
            id={errorId}
            role="alert"
            className="mt-2 min-h-10 text-[13px] leading-5 text-loss"
          >
            {error}
          </p>
        </div>

        <div>
          <p className="field-label mb-2">{t("online:compose.setup")}</p>
          {/* the carousel is typed on every setup there is, and only ever
              offers the playable ones. the guard is what says so out loud. */}
          <SetupCarousel
            setupType={setupType}
            onChange={(next) => {
              if (isPlayableSetup(next)) setSetupType(next)
            }}
            preview={
              <GameCanvas
                state={preview}
                possibleMoves={[]}
                marbleDesign={marbleDesign}
                showCoordinates={false}
                showLabels={false}
                interactive={false}
              />
            }
          />
        </div>

        <div>
          <p className="field-label mb-2">{t("online:compose.side")}</p>
          <ColorChoice
            value={side}
            onChange={setSide}
            marbleDesign={marbleDesign}
          />
        </div>
      </div>
    </Sheet>
  )
}
