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
        className={cn(
          "relative h-6 w-11 shrink-0 rounded-full transition focus-visible:outline-none",
          "focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-2 focus-visible:ring-offset-surface",
          checked ? "bg-brand" : "bg-surface-3",
        )}
      >
        <span
          className={cn(
            "absolute top-0.5 left-0.5 h-5 w-5 rounded-full bg-white shadow transition-transform",
            checked && "translate-x-5",
          )}
        />
      </TapButton>
    </div>
  )
}
