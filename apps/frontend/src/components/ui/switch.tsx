import type { SwitchHandle, SwitchProps } from "@repo/nativ/components"
import { Switch as BaseSwitch, useSwitch } from "@repo/nativ/components"
import { cn } from "@repo/nativ/utils"
import { forwardRef } from "react"

function SwitchThumb() {
  const { isDisabled } = useSwitch()

  return (
    <BaseSwitch.Thumb
      className={cn(
        "rounded-full bg-surface shadow-sm",
        isDisabled && "opacity-50",
      )}
    />
  )
}
SwitchThumb.displayName = "Switch.Thumb"

export const Switch = forwardRef<SwitchHandle, SwitchProps>(
  function Switch({ checked, className, ...props }, ref) {
    return (
      <BaseSwitch
        ref={ref}
        checked={checked}
        className={cn(
          "rounded-full bg-secondary transition-colors",
          checked && "bg-primary",
          className,
        )}
        {...props}
      >
        <SwitchThumb />
      </BaseSwitch>
    )
  },
)
