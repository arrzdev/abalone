import { cn } from "@repo/nativ/utils"
import type { KeyboardEvent, ReactNode } from "react"
import { useCallback, useEffect, useId, useRef, useState } from "react"
import { CheckIcon, ChevronDownIcon } from "@/components/icons"
import { TapButton } from "@/components/ui/tap-button"
import { useClickOutside } from "@/hooks/use-click-outside"

/**
 * An option's `label` stays a plain string so it can also be the accessible
 * name; anything decorative goes in `icon`.
 */
export type SelectOption<T extends string> = {
  value: T
  label: string
  icon?: ReactNode
}

export type SelectProps<T extends string> = {
  value: T
  onChange: (value: T) => void
  options: SelectOption<T>[]
  label: string
  className?: string
  buttonClassName?: string
}

/**
 * Custom listbox replacing the native <select>, which renders with the OS
 * dropdown and cannot be themed.
 */
export function Select<T extends string>({
  value,
  onChange,
  options,
  label,
  className,
  buttonClassName,
}: SelectProps<T>) {
  const [open, setOpen] = useState(false)
  const [activeIndex, setActiveIndex] = useState(() =>
    Math.max(
      0,
      options.findIndex((o) => o.value === value),
    ),
  )
  const containerRef = useRef<HTMLDivElement>(null)
  const listRef = useRef<HTMLUListElement>(null)
  const listboxId = useId()

  const close = useCallback(() => setOpen(false), [])
  useClickOutside(containerRef, close, open)

  const selected =
    options.find((option) => option.value === value) ?? options[0]

  useEffect(() => {
    if (!open) return
    setActiveIndex(
      Math.max(
        0,
        options.findIndex((option) => option.value === value),
      ),
    )
  }, [open, options, value])

  // Keep the highlighted option in view during keyboard navigation.
  // biome-ignore lint/correctness/useExhaustiveDependencies: `activeIndex` is what makes this run again; the row it points at is found in the DOM.
  useEffect(() => {
    if (!open) return
    listRef.current
      ?.querySelector('[data-active="true"]')
      ?.scrollIntoView({ block: "nearest" })
  }, [activeIndex, open])

  const commit = useCallback(
    (index: number) => {
      const option = options[index]
      if (option) onChange(option.value)
      setOpen(false)
    },
    [onChange, options],
  )

  const handleKeyDown = (event: KeyboardEvent<HTMLButtonElement>) => {
    if (!open) {
      if (
        event.key === "Enter" ||
        event.key === " " ||
        event.key === "ArrowDown"
      ) {
        event.preventDefault()
        setOpen(true)
      }
      return
    }

    switch (event.key) {
      case "Escape":
        event.preventDefault()
        setOpen(false)
        break
      case "ArrowDown":
        event.preventDefault()
        setActiveIndex((index) => (index + 1) % options.length)
        break
      case "ArrowUp":
        event.preventDefault()
        setActiveIndex(
          (index) => (index - 1 + options.length) % options.length,
        )
        break
      case "Home":
        event.preventDefault()
        setActiveIndex(0)
        break
      case "End":
        event.preventDefault()
        setActiveIndex(options.length - 1)
        break
      case "Enter":
      case " ":
        event.preventDefault()
        commit(activeIndex)
        break
      default:
        break
    }
  }

  return (
    <div className={cn("relative", className)} ref={containerRef}>
      <TapButton
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={open ? listboxId : undefined}
        aria-label={label}
        onClick={() => setOpen((current) => !current)}
        onKeyDown={handleKeyDown}
        className={cn(
          "flex w-full items-center justify-between gap-3 rounded-lg bg-surface-4 px-3 py-2.5",
          "text-left text-sm font-medium text-white transition hover:bg-surface-5",
          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand",
          // Open reads as a shade up, not as an accent outline. The chevron has
          // already turned over; this is the surface agreeing with it.
          open && "bg-surface-5",
          buttonClassName,
        )}
      >
        {selected?.icon}
        <span className="flex-1 truncate">{selected?.label}</span>
        <ChevronDownIcon
          size={18}
          className={cn(
            "shrink-0 text-muted transition",
            open && "rotate-180",
          )}
        />
      </TapButton>

      {open && (
        // The rounding and the scrolling live on different boxes on purpose: an
        // overlay scrollbar is painted over its own element's corners, so the
        // radius has to belong to a parent that clips it.
        //
        // The hairline is doing the work, not the fill. This opens over the
        // settings dialog, which is `surface-2`, and over the page, which is
        // lighter than either — so no fill can sit above both, and one picked
        // to clear the page vanishes into the dialog. An edge reads against
        // whichever it lands on.
        <div className="absolute z-50 mt-2 w-full overflow-hidden rounded-lg bg-surface-3 shadow-2xl shadow-black/60 ring-1 ring-border">
          <ul
            id={listboxId}
            ref={listRef}
            // biome-ignore lint/a11y/noNoninteractiveElementToInteractiveRole: a listbox of rows is a list; the rows themselves are the buttons.
            role="listbox"
            aria-label={label}
            tabIndex={-1}
            className="panel-scroll max-h-64 overflow-y-auto p-1"
          >
            {options.map((option, index) => {
              const isSelected = option.value === value
              return (
                <li key={option.value}>
                  <TapButton
                    role="option"
                    aria-selected={isSelected}
                    data-active={index === activeIndex}
                    onMouseEnter={() => setActiveIndex(index)}
                    onClick={() => commit(index)}
                    className={cn(
                      "flex w-full items-center gap-2 rounded-md px-3 py-2 text-left text-sm transition",
                      // A row has to clear the panel under it, not the dialog
                      // under that — one step up from `surface-3` is a step
                      // nobody can see.
                      index === activeIndex
                        ? "bg-elevated text-white"
                        : "text-subtle",
                    )}
                  >
                    {option.icon}
                    <span className="flex-1 truncate font-medium">
                      {option.label}
                    </span>
                    {isSelected && (
                      <CheckIcon
                        size={16}
                        className="shrink-0 text-brand"
                      />
                    )}
                  </TapButton>
                </li>
              )
            })}
          </ul>
        </div>
      )}
    </div>
  )
}
