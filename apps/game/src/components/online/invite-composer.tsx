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
import { BackIcon } from "@/components/icons"
import { GameSummaryRow } from "@/components/online/game-summary-row"
import { InviteLinkCard } from "@/components/online/invite-link-card"
import { RecentOpponents } from "@/components/online/recent-opponents"
import { SetupCarousel } from "@/components/setup-carousel"
import { Button } from "@/components/ui/button"
import { Sheet } from "@/components/ui/sheet"
import { StatusLine } from "@/components/ui/status-line"
import { TextField } from "@/components/ui/text-field"
import type { SendInviteInput } from "@/data/online/mutations"
import { useMarbleDesign } from "@/hooks/use-marble-design"
import type { RecentOpponent } from "@/utils/recent-opponents"

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
  /** Who the player has played lately. `undefined` while the games load. */
  recentOpponents?: RecentOpponent[]
}

type View = "main" | "game"

/**
 * Asking somebody to play: who first, then the terms in one line.
 *
 * Who is a row of people you have played and a field for anybody else. There is
 * no lookup in front of the field, no "player found" card: you pick a face or
 * type a name and press send, and the only thing that can come back is that
 * nobody is called that. A search on every keystroke to confirm a name you
 * already know is a request per letter for a fact you learn anyway.
 *
 * The opening and the side are the offline panel's own controls, folded into a
 * summary row, because most invites leave both as they are. Change swaps the
 * sheet to a panel with the carousel and the side picker. The link sits between
 * the name and the terms as the other way to ask, and it carries the terms.
 */
export function InviteComposer({
  open,
  onClose,
  onSend,
  pending,
  error,
  onLinkCreated,
  recentOpponents,
}: InviteComposerProps) {
  const { t } = useTranslation()
  const errorId = useId()
  const [marbleDesign] = useMarbleDesign()
  const [view, setView] = useState<View>("main")
  const [username, setUsername] = useState("")
  const [pickedName, setPickedName] = useState<string | null>(null)
  //an error describes the name that was sent, so it ends at the next edit
  const [isErrorStale, setIsErrorStale] = useState(false)
  const [setupType, setSetupType] = useState<PlayableSetup>(DEFAULT_SETUP)
  const [side, setSide] = useState<ColorChoiceValue>("random")

  const typedName = username.trim()
  //what the send goes to: the typed name, or the face picked. the two never
  //coexist, each clears the other
  const target = typedName || pickedName || ""
  const shownError = isErrorStale ? undefined : error
  const hasChips =
    (recentOpponents?.length ?? 0) > 0 || recentOpponents === undefined

  //the opening position and nothing after it, so stepping through the setups
  //costs one board rather than one board per press
  const preview = useMemo(
    () => createGameState(setupType, "black", "local"),
    [setupType],
  )

  function handleType(next: string) {
    setUsername(next)
    setPickedName(null)
    setIsErrorStale(true)
  }

  function handlePick(name: string) {
    setPickedName(name)
    setUsername("")
    setIsErrorStale(true)
  }

  function handleSend() {
    setIsErrorStale(false)
    onSend({ username: target, setupType, side })
  }

  function handleClose() {
    if (view === "game") return setView("main")
    onClose()
  }

  const isGameView = view === "game"
  const sendLabel = target
    ? t("online:compose.send_to", { name: target })
    : t("online:compose.send")

  return (
    <Sheet
      open={open}
      onClose={handleClose}
      title={
        isGameView ? t("online:compose.game") : t("online:compose.title")
      }
      hideTitle={isGameView}
      pinFooter
      className="lg:max-w-[476px]"
      footer={
        <>
          {!isGameView && (
            <Button
              variant="primary"
              size="lg"
              className="h-auto min-h-[54px] w-full text-balance [overflow-wrap:anywhere]"
              //an empty target is the only thing this can rule out on its own.
              //how short a name may be is the server's rule, and pre-empting
              //it here means a button that will not press and will not say why
              disabled={target.length === 0}
              pending={pending}
              onClick={handleSend}
            >
              {sendLabel}
            </Button>
          )}
          {isGameView && (
            <Button
              variant="primary"
              size="lg"
              className="w-full"
              onClick={() => setView("main")}
            >
              {t("online:compose.done")}
            </Button>
          )}
        </>
      }
    >
      {/* Both views stay mounted, one hidden: the link card holds the link it
          made, and going to the game panel and back without changing anything
          must not throw it away. */}
      <div className="flex flex-col gap-y-5" hidden={isGameView}>
        <div className="flex flex-col gap-y-3">
          <RecentOpponents
            opponents={recentOpponents}
            value={pickedName ?? typedName}
            onChange={handlePick}
            disabled={pending}
            invalid={Boolean(shownError) && Boolean(pickedName)}
          />

          <div className="flex flex-col gap-y-2">
            <TextField
              label={
                hasChips
                  ? t("online:compose.someone_else")
                  : t("online:compose.username")
              }
              placeholder={t("online:compose.username_placeholder")}
              prefix="@"
              value={username}
              onChange={(event) => handleType(event.target.value)}
              autoComplete="off"
              autoCapitalize="none"
              autoCorrect="off"
              spellCheck={false}
              maxLength={20}
              disabled={pending}
              invalid={Boolean(shownError) && !pickedName}
              describedBy={errorId}
            />

            {/* The name is the only thing here that can be wrong, so the line
                belongs to it rather than to the sheet.

                Always in the layout, with a hint in it until the server has
                something to say about the name. A message that arrives into no
                space of its own pushes the rest down and grows the sheet: a
                press on Send that moves the thing under the thumb. */}
            <StatusLine
              id={errorId}
              role="alert"
              message={shownError}
              messageClassName="text-loss"
              hint={t("online:compose.username_hint")}
              reserve={SEND_ERRORS.map((key) => t(key))}
            />
          </div>
        </div>

        <div className="flex flex-col gap-y-3">
          {/* Keyed on the terms, so changing either one drops a link made on
              the old ones rather than leaving it in the field. */}
          <InviteLinkCard
            key={`${setupType}:${side}`}
            setupType={setupType}
            side={side}
            onCreated={onLinkCreated}
          />

          <GameSummaryRow
            setupType={setupType}
            side={side}
            onChange={() => setView("game")}
          />
        </div>
      </div>

      <div className="flex flex-col gap-y-5" hidden={!isGameView}>
        <div className="flex items-center gap-x-1">
          <Button
            variant="ghost"
            size="icon"
            className="-ms-2"
            aria-label={t("online:compose.back")}
            title={t("online:compose.back")}
            onClick={() => setView("main")}
          >
            <BackIcon size={22} />
          </Button>
          <p
            aria-hidden="true"
            className="font-display text-[22px] font-bold tracking-[-0.02em] text-white"
          >
            {t("online:compose.game")}
          </p>
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
      </div>
    </Sheet>
  )
}
