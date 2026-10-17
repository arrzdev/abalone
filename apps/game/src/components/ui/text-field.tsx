import { Input } from "@repo/nativ/components"
import { cn } from "@repo/nativ/utils"
import type { ComponentPropsWithRef } from "react"
import { useId, useState } from "react"
import { useTranslation } from "react-i18next"
import { EyeIcon, EyeOffIcon } from "@/components/icons"

export type TextFieldProps = Omit<
  ComponentPropsWithRef<typeof Input>,
  "children"
> & {
  label: string
  /**
   * Marks this field as the one at fault: red ring and `aria-invalid`. The
   * message itself is not the field's — a form says one thing at a time, so it
   * belongs to the form's own error line rather than to a slot under each box.
   */
  invalid?: boolean
  /** Id of the element carrying that message, for `aria-describedby`. */
  describedBy?: string
  /**
   * A fixed character the value is always written after — the `@` on a
   * username. Decoration, not content: it is never in the value, so nothing
   * downstream has to strip it back off.
   */
  prefix?: string
  /**
   * Keep the label for screen readers and take it off the screen, for a field
   * whose row already says what it is (the invite link, in place of the button
   * that made it).
   */
  hideLabel?: boolean
  /** Extra classes for the box around the label and the field, for a row that sizes it. */
  containerClassName?: string
}

/**
 * A labelled single-line field. Tier 2 over nativ's `Input`: the label, the
 * brand surface, the red ring when this is the field at fault, and, on a
 * password, the eye. The message that goes with that ring belongs to the form,
 * not here.
 *
 * The reveal is the field's own rather than a prop, because a masked field
 * always wants it: this app has no password manager to fall back on and no
 * "email a reset link", so a typo you cannot see is an account you cannot get
 * into. The button swaps the `type` only — the value never leaves the input, so
 * autofill and the form's own `FormData` read are untouched.
 */
export function TextField({
  label,
  invalid = false,
  describedBy,
  prefix,
  hideLabel = false,
  containerClassName,
  id,
  className,
  type,
  ...props
}: TextFieldProps) {
  const { t } = useTranslation()
  const generatedId = useId()
  const [isRevealed, setIsRevealed] = useState(false)

  const fieldId = id ?? generatedId
  const isPassword = type === "password"

  return (
    //no `gap`: the label belongs to the box under it and nothing else, so the
    //spacing between one field and the next is the caller's to set
    <div className={cn("flex flex-col", containerClassName)}>
      <label
        htmlFor={fieldId}
        className={cn("field-label mb-2", hideLabel && "sr-only")}
      >
        {label}
      </label>

      <div className="relative">
        {prefix && (
          <span
            aria-hidden="true"
            className="pointer-events-none absolute inset-y-0 start-4 flex items-center text-base text-faint"
          >
            {prefix}
          </span>
        )}

        <Input
          id={fieldId}
          type={isPassword && isRevealed ? "text" : type}
          aria-invalid={invalid}
          aria-describedby={describedBy}
          className={cn(
            //text-base rather than text-sm: iOS zooms the page when a field
            //smaller than 16px takes focus, and leaves it zoomed after blur.
            "h-[54px] w-full rounded-xl border border-transparent bg-surface-2 px-4 text-base text-white",
            //the outline rests in the ring's own blue. `transition` eases the
            //outline colour too, and from the default (the white text colour)
            //the ring flashed white before it turned blue. the property list
            //stays as it is: narrowing it left WebKit reading the focused
            //field's box hundreds of pixels off for a moment after focus
            "outline-brand-light transition placeholder:text-faint",
            "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand",
            //the border is always there and usually transparent, so colouring
            //it moves nothing. it has to be a border rather than a ring: the
            //dialog is centred by flex, so an odd leftover parks the box on
            //half a pixel, and a ring drawn outside it loses its top and bottom
            //edges to the dark behind them while the sides, on whole pixels,
            //stay solid. a border shares the edge with the field's own fill,
            //so the same half pixel blends into the box instead of away from it
            invalid && "border-loss/70 bg-loss/5",
            //room for the character in front of the value
            prefix && "ps-8",
            //room for the eye, so a long password runs under the label and not
            //under the button
            isPassword && "pe-14",
            className,
          )}
          {...props}
        />

        {isPassword && (
          <button
            type="button"
            //the label says what pressing it does next, which is what a
            //screen reader announces on the control that is doing it
            aria-label={
              isRevealed
                ? t("common:auth.hide_password")
                : t("common:auth.show_password")
            }
            aria-pressed={isRevealed}
            className="absolute inset-y-0 end-0 flex w-14 items-center justify-center rounded-e-xl text-faint transition-colors hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand"
            onClick={() => setIsRevealed(!isRevealed)}
          >
            {isRevealed && <EyeOffIcon size={20} />}
            {!isRevealed && <EyeIcon size={20} />}
          </button>
        )}
      </div>
    </div>
  )
}
