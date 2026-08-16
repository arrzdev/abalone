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

  /**
   * Where the highlight sits when nothing is being pointed at: on the option
   * that is already chosen. It is the same mark either way — what a press would
   * pick, which with the pointer off the list is what is picked already.
   */
  const selectedIndex = Math.max(
    0,
    options.findIndex((option) => option.value === value),
  )

  useEffect(() => {
    if (!open) return
    setActiveIndex(selectedIndex)
  }, [open, selectedIndex])

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
          "flex h-12 w-full items-center justify-between gap-3 rounded-xl bg-surface-2 px-3.5",
          "text-left text-[15px] font-medium text-white transition hover:bg-surface-3",
          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand",
          // Open is the turned chevron and the list below, not a shade change:
          // the list is the lighter surface, and a button that lightens to meet
          // it makes the two read as one tall box with a seam across it.
          open && "hover:bg-surface-2",
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
        // The fill does the work, not an edge. A hairline and a heavy shadow
        // around a panel that is already a lighter grey than everything under
        // it is three ways of saying the same thing, and the outline is the one
        // that reads as a border drawn by a different design.
        //
        // Same corner as the button it drops out of: two radii on one control
        // is the join you notice.
        <div className="absolute z-50 mt-2 w-full overflow-hidden rounded-xl bg-surface-3 shadow-lg shadow-black/30">
          <ul
            id={listboxId}
            ref={listRef}
            // biome-ignore lint/a11y/noNoninteractiveElementToInteractiveRole: a listbox of rows is a list; the rows themselves are the buttons.
            role="listbox"
            aria-label={label}
            tabIndex={-1}
            //the pointer leaving takes its highlight with it. a row left lit
            //under a cursor that is somewhere else is the list claiming a
            //choice nobody is making, and it hides the one already made
            onMouseLeave={() => setActiveIndex(selectedIndex)}
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
                      "flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm transition",
                      // A row has to clear the dropdown it is in, not the dialog
                      // under that — one step is all it takes, and two would
                      // make the hovered row the brightest thing on screen.
                      index === activeIndex
                        ? "bg-white/8 text-white"
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
