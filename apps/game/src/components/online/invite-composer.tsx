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
import { InviteLinkMaker } from "@/components/online/invite-link-maker"
import { SetupCarousel } from "@/components/setup-carousel"
import { Button } from "@/components/ui/button"
import { Sheet } from "@/components/ui/sheet"
import { StatusLine } from "@/components/ui/status-line"
import { TextField } from "@/components/ui/text-field"
import type { SendInviteInput } from "@/data/online/mutations"
import { useMarbleDesign } from "@/hooks/use-marble-design"

/** What the server can say about a name, for its line to hold room for. */
const SEND_ERRORS = [
  "errors:api_player_not_found",
  "errors:api_invite_self",
  "errors:api_invite_exists",
  "errors:api_invalid_input",
  "errors:api_rate_limit_exceeded",
  "errors:api_service_unavailable",
  "errors:network_unreachable",
  "errors:unknown",
] as const

export type InviteComposerProps = {
  open: boolean
  onClose: () => void
  onSend: (input: SendInviteInput) => void
  pending: boolean
  /** What went wrong last time, already translated. */
  error?: string
  /** A link was made, so whoever takes it opens a game from outside. */
  onLinkCreated?: () => void
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
 *
 * The link sits under the terms rather than beside the name, because it uses
 * them: it is for when there is no name to type, and the board and the side it
 * carries are the ones picked above it.
 */
export function InviteComposer({
  open,
  onClose,
  onSend,
  pending,
  error,
  onLinkCreated,
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
        <div className="flex flex-col gap-y-2">
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
            describedBy={errorId}
          />

          {/* The name is the only thing here that can be wrong, so the line
              belongs to it rather than to the sheet.

              Always in the layout, with a hint in it until the server has
              something to say about the name. A message that arrives into no
              space of its own pushes the board preview down and grows the
              sheet: a press on Send that moves the thing under the thumb. */}
          <StatusLine
            id={errorId}
            role="alert"
            message={error}
            messageClassName="text-loss"
            hint={t("online:compose.username_hint")}
            reserve={SEND_ERRORS.map((key) => t(key))}
          />
        </div>

        <div className="flex flex-col gap-y-2">
          <p className="field-label">{t("online:compose.setup")}</p>
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

        <div className="flex flex-col gap-y-2">
          <p className="field-label">{t("online:compose.side")}</p>
          <ColorChoice
            value={side}
            onChange={setSide}
            marbleDesign={marbleDesign}
          />
        </div>

        {/* Keyed on the terms, so changing either one drops a link made on
            the old ones rather than leaving it in the field. */}
        <InviteLinkMaker
          key={`${setupType}:${side}`}
          setupType={setupType}
          side={side}
          onCreated={onLinkCreated}
        />
      </div>
    </Sheet>
  )
}
