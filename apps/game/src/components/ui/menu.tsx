import { cn } from "@repo/nativ/utils"
import type { ComponentType, ReactNode } from "react"
import {
  createContext,
  useCallback,
  useContext,
  useRef,
  useState,
} from "react"
import type { IconProps } from "@/components/icons"
import { TapButton } from "@/components/ui/tap-button"
import { useClickOutside } from "@/hooks/use-click-outside"

//long enough to cross the gap between the trigger and the panel without the
//menu chasing the pointer away, short enough that leaving reads as closing
const CLOSE_DELAY_MS = 120

const MenuContext = createContext<(() => void) | null>(null)

/** Closes the menu this item sits in. Every row calls it after acting. */
function useCloseMenu() {
  const close = useContext(MenuContext)
  if (!close) throw new Error("Menu rows must be used inside <Menu>.")
  return close
}

export type MenuProps = {
  /** What the trigger says. Also the menu's accessible name. */
  label: ReactNode
  /** Spoken name, when `label` is an icon rather than words. */
  ariaLabel?: string
  /** Which edge of the trigger the panel hangs from. */
  align?: "start" | "end"
  className?: string
  triggerClassName?: string
  children: ReactNode
}

/**
 * A menu that opens under its trigger: on hover with a mouse, on a press with
 * anything else.
 *
 * Hover alone would be a menu a keyboard cannot reach and a phone cannot open,
 * so the press is always live and Escape always closes. Below `lg` nothing in
 * the shell renders one of these — a phone gets the same choices as a sheet.
 */
export function Menu({
  label,
  ariaLabel,
  align = "start",
  className,
  triggerClassName,
  children,
}: MenuProps) {
  const [open, setOpen] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)
  const closeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const cancelClose = useCallback(() => {
    if (closeTimerRef.current === null) return
    clearTimeout(closeTimerRef.current)
    closeTimerRef.current = null
  }, [])

  const close = useCallback(() => {
    cancelClose()
    setOpen(false)
  }, [cancelClose])

  useClickOutside(containerRef, close, open)

  //a finger's "enter" is the tap that already opened this; only a mouse hovers
  const openOnHover = (pointerType: string) => {
    if (pointerType !== "mouse") return
    cancelClose()
    setOpen(true)
  }

  const closeAfterDelay = (pointerType: string) => {
    if (pointerType !== "mouse") return
    cancelClose()
    closeTimerRef.current = setTimeout(
      () => setOpen(false),
      CLOSE_DELAY_MS,
    )
  }

  return (
    // biome-ignore lint/a11y/noStaticElementInteractions: hover is the shortcut; the trigger below is the control, and it answers presses and the keyboard on its own.
    <div
      ref={containerRef}
      className={cn("relative", className)}
      onPointerEnter={(event) => openOnHover(event.pointerType)}
      onPointerLeave={(event) => closeAfterDelay(event.pointerType)}
      onKeyDown={(event) => {
        if (event.key === "Escape") close()
      }}
    >
      <TapButton
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label={ariaLabel}
        onClick={() => setOpen((value) => !value)}
        className={cn(
          "flex h-9 items-center gap-2 rounded-lg px-3 text-sm font-semibold transition-colors duration-200 ease-out focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand",
          open && "bg-white/10 text-white",
          !open && "text-muted hover:bg-white/10 hover:text-white",
          triggerClassName,
        )}
      >
        {label}
      </TapButton>

      {open && (
        <MenuContext.Provider value={close}>
          {/* The 0.5rem gap is padding rather than a margin: a real gap between
              the trigger and the panel is a strip the pointer crosses, and
              crossing it would close the menu on the way in. */}
          <div
            className={cn(
              "absolute top-full z-100 pt-2",
              align === "start" && "left-0",
              align === "end" && "right-0",
            )}
          >
            {/* The rows are the buttons; this is the box they sit in. */}
            <div
              role="menu"
              className="min-w-52 origin-top overflow-hidden rounded-xl bg-surface-2 p-1 shadow-2xl shadow-black/60 ring-1 ring-border motion-safe:animate-menu-in"
            >
              {children}
            </div>
          </div>
        </MenuContext.Provider>
      )}
    </div>
  )
}

const ROW_CLASS =
  "flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left text-sm font-medium text-subtle transition-colors duration-200 ease-out hover:bg-surface-3 hover:text-white focus-visible:outline-none focus-visible:bg-surface-3 focus-visible:text-white"

export type MenuItemProps = {
  icon?: ComponentType<IconProps>
  children: ReactNode
  /** Runs on press. The menu closes first, so it can navigate freely. */
  onSelect: () => void
  className?: string
}

/** A row that does something. */
export function MenuItem({
  icon: Icon,
  children,
  onSelect,
  className,
}: MenuItemProps) {
  const close = useCloseMenu()

  return (
    <TapButton
      role="menuitem"
      className={cn(ROW_CLASS, className)}
      onClick={() => {
        close()
        onSelect()
      }}
    >
      {Icon && <Icon size={18} className="shrink-0 opacity-70" />}
      <span className="min-w-0 flex-1 truncate">{children}</span>
    </TapButton>
  )
}

/** A gap between groups of rows. */
export function MenuSeparator() {
  return <div className="my-1 h-px bg-white/10" />
}
