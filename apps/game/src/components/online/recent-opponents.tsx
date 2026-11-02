import { cn } from "@repo/nativ/utils"
import { useId } from "react"
import { useTranslation } from "react-i18next"
import { Avatar } from "@/components/ui/avatar"
import type { RecentOpponent } from "@/utils/recent-opponents"
import { RECENT_OPPONENT_LIMIT } from "@/utils/recent-opponents"

/** One per chip the list can fill, so the row is its full height while it loads. */
const SKELETON_SLOTS = Array.from(
  { length: RECENT_OPPONENT_LIMIT },
  (_, slot) => `slot-${slot}`,
)

/** The chip's box, held while the list loads so nothing moves when it lands. */
const CHIP_CLASS =
  "flex min-w-0 max-w-20 flex-1 flex-col items-center gap-1"

export type RecentOpponentsProps = {
  /** `undefined` while the games load: four empty chips hold the row. */
  opponents: RecentOpponent[] | undefined
  /** The name that is checked, matched without regard to case. */
  value: string | null
  onChange: (name: string) => void
  /** A request is out, so nothing here is worth changing. */
  disabled?: boolean
  /** The last send was refused and this chip is the name it was sent to. */
  invalid?: boolean
}

/**
 * The people you played lately, to ask again with one tap.
 *
 * One radio group, so the arrow keys move between them and the whole row is a
 * single stop in the tab order. The native radio sits over the chip, see-through,
 * so the whole chip is the target and the browser does the keyboard. The ring
 * is a shadow, not a border: a checked chip moves nothing.
 *
 * Nobody to offer, and the row is not here: a first invite has no one to ask
 * again, and an empty row is a hole in the sheet.
 */
export function RecentOpponents({
  opponents,
  value,
  onChange,
  disabled = false,
  invalid = false,
}: RecentOpponentsProps) {
  const { t } = useTranslation()
  const labelId = useId()
  const groupName = useId()

  if (opponents?.length === 0) return null

  const checkedName = value?.toLowerCase() ?? null

  return (
    <div className="flex flex-col gap-y-2">
      <p id={labelId} className="field-label">
        {t("online:compose.recents")}
      </p>

      <div
        role="radiogroup"
        aria-labelledby={labelId}
        aria-busy={opponents === undefined || undefined}
        className="flex gap-2"
      >
        {opponents === undefined &&
          SKELETON_SLOTS.map((slot) => (
            <div key={slot} aria-hidden="true" className={CHIP_CLASS}>
              <div className="size-11 rounded-[11px] bg-surface-3" />
              <div className="h-4 w-10 rounded bg-surface-2" />
            </div>
          ))}

        {opponents?.map((opponent) => (
          <OpponentChip
            key={opponent.name}
            opponent={opponent}
            groupName={groupName}
            checked={checkedName === opponent.name.toLowerCase()}
            invalid={invalid}
            disabled={disabled}
            onChange={onChange}
          />
        ))}
      </div>
    </div>
  )
}

type OpponentChipProps = {
  opponent: RecentOpponent
  groupName: string
  checked: boolean
  invalid: boolean
  disabled: boolean
  onChange: (name: string) => void
}

/** One person: a face over a name. Checked, the face is ringed. */
function OpponentChip({
  opponent,
  groupName,
  checked,
  invalid,
  disabled,
  onChange,
}: OpponentChipProps) {
  return (
    <label
      title={opponent.name}
      className={cn(
        CHIP_CLASS,
        "group relative cursor-pointer rounded-xl transition-opacity",
        disabled && "cursor-not-allowed opacity-45",
      )}
    >
      <input
        type="radio"
        name={groupName}
        value={opponent.name}
        checked={checked}
        disabled={disabled}
        onChange={() => onChange(opponent.name)}
        className="peer absolute inset-0 z-10 size-full cursor-[inherit] appearance-none rounded-xl opacity-0"
      />

      {/* The face is for the eye: its initial read first would put a stray
          letter in front of the name in the chip's accessible name. */}
      <span
        aria-hidden="true"
        className={cn(
          "rounded-[11px] transition-shadow peer-focus-visible:shadow-[0_0_0_2px_var(--color-surface),0_0_0_4px_var(--color-brand)]",
          checked &&
            !invalid &&
            "shadow-[0_0_0_2px_var(--color-surface),0_0_0_4px_var(--color-brand-light)] peer-focus-visible:shadow-[0_0_0_2px_var(--color-surface),0_0_0_4px_var(--color-brand)]",
          checked &&
            invalid &&
            "shadow-[0_0_0_2px_var(--color-surface),0_0_0_4px_var(--color-loss)]",
        )}
      >
        <Avatar src={opponent.avatarUrl} name={opponent.name} size={44} />
      </span>

      <span
        className={cn(
          "block w-full truncate text-center font-display text-xs font-semibold",
          checked && "text-white",
          !checked && "text-muted",
        )}
      >
        {opponent.name}
      </span>
    </label>
  )
}
