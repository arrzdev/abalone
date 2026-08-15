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
    <div className="flex flex-col">
      <label
        htmlFor={fieldId}
        className="mb-2 text-sm font-semibold text-subtle"
      >
        {label}
      </label>

      <div className="relative">
        <Input
          id={fieldId}
          type={isPassword && isRevealed ? "text" : type}
          aria-invalid={invalid}
          aria-describedby={describedBy}
          className={cn(
            //text-base rather than text-sm: iOS zooms the page when a field
            //smaller than 16px takes focus, and the app is not zoomable back out.
            "h-14 w-full rounded-xl bg-surface-4 px-4 text-base text-white",
            "transition placeholder:text-faint",
            "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand",
            //a ring rather than a border, so turning red does not resize the field
            invalid && "ring-2 ring-loss",
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
