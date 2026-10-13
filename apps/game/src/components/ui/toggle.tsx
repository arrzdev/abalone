import { cn } from "@repo/nativ/utils"
import { useId } from "react"
import { TapButton } from "@/components/ui/tap-button"

export type ToggleProps = {
  checked: boolean
  onChange: (checked: boolean) => void
  label: string
  description?: string
  className?: string
}

/** Switch-style checkbox. */
export function Toggle({
  checked,
  onChange,
  label,
  description,
  className,
}: ToggleProps) {
  const id = useId()

  return (
    <div
      className={cn("flex items-center justify-between gap-4", className)}
    >
      <label htmlFor={id} className="cursor-pointer select-none">
        <span className="block text-sm font-medium text-white">
          {label}
        </span>
        {description && (
          <span className="mt-0.5 block text-xs text-muted">
            {description}
          </span>
        )}
      </label>
      <TapButton
        id={id}
        role="switch"
        aria-checked={checked}
        aria-label={label}
        // The switch is a plain rounded square with no text on it, so on its own
        // it says nothing about what it turns on. The label beside it does, and
        // this is that label under the pointer as well.
        title={description ? `${label} — ${description}` : label}
        onClick={() => onChange(!checked)}
        // A 44px box to press, handed back to the row by its negative margin,
        // with the track drawn inside it. The track is not the box: given the
        // box's height as a transparent border, its round ends took the
        // border's radius too and it drew as an ellipse (TUD-973).
        className="-my-2.5 flex h-11 w-11 shrink-0 items-center rounded-full"
      >
        <span
          className={cn(
            "relative h-6 w-11 rounded-full transition-colors",
            checked ? "bg-brand" : "bg-surface-3",
          )}
        >
          <span
            className={cn(
              "absolute top-0.5 left-0.5 h-5 w-5 rounded-full bg-white shadow transition-transform",
              checked && "translate-x-5",
            )}
          />
        </span>
      </TapButton>
    </div>
  )
}
