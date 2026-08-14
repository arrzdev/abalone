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
   * What is wrong with what was typed. The slot below the field is always in the
   * layout, so an error arriving does not shove the submit button down the page
   * under someone's thumb.
   */
  error?: string
}

/**
 * A labelled single-line field. Tier 2 over nativ's `Input`: the label, the
 * brand surface, the reserved error line — and, on a password, the eye.
 *
 * The reveal is the field's own rather than a prop, because a masked field
 * always wants it: this app has no password manager to fall back on and no
 * "email a reset link", so a typo you cannot see is an account you cannot get
 * into. The button swaps the `type` only — the value never leaves the input, so
 * autofill and the form's own `FormData` read are untouched.
 */
export function TextField({
  label,
  error,
  id,
  className,
  type,
  ...props
}: TextFieldProps) {
  const { t } = useTranslation()
  const generatedId = useId()
  const [isRevealed, setIsRevealed] = useState(false)

  const fieldId = id ?? generatedId
  const errorId = `${fieldId}-error`
  const isPassword = type === "password"

  return (
    //no `gap`: the label sits closer to its own field than the error line does,
    //and the error line is what a caller stacking these is spacing against
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
          aria-invalid={Boolean(error)}
          aria-describedby={error ? errorId : undefined}
          className={cn(
            //text-base rather than text-sm: iOS zooms the page when a field
            //smaller than 16px takes focus, and the app is not zoomable back out.
            "h-14 w-full rounded-xl bg-surface-4 px-4 text-base text-white",
            "transition placeholder:text-faint",
            "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand",
            //a ring rather than a border, so turning red does not resize the field
            error && "ring-2 ring-loss",
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

      {/* Empty but present, and 20px of the field either way — a form stacking
          these gets its spacing from the box, not from whether it is currently
          complaining. `role="alert"` announces whatever lands in it. */}
      <p
        id={errorId}
        role="alert"
        className="mt-1 min-h-4 text-xs leading-4 text-loss"
      >
        {error}
      </p>
    </div>
  )
}
