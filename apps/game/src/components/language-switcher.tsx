import { cn } from "@repo/nativ/utils"
import { useCallback, useRef, useState } from "react"
import { useTranslation } from "react-i18next"
import { TapButton } from "@/components/ui/tap-button"
import { useClickOutside } from "@/hooks/use-click-outside"
import type { Language } from "@/i18n"
import {
  changeLanguage,
  LANGUAGE_FLAGS,
  LANGUAGE_NAMES,
  SUPPORTED_LANGUAGES,
} from "@/i18n"

/**
 * `ghost` sits inside a panel that already provides a surface; `solid` is for
 * when the switcher floats over the page and needs its own — a filled block of
 * the same greys everything else is built from, a shade up from the page it
 * sits on rather than an outlined pane of frosted glass.
 */
const TRIGGER_VARIANTS = {
  ghost: "text-white/60 hover:bg-white/10 hover:text-white",
  solid: "bg-surface-4 text-white hover:bg-surface-5",
}

export type LanguageSwitcherVariant = keyof typeof TRIGGER_VARIANTS

/**
 * Flag emoji sit in a fixed box: their glyph metrics vary by font and don't
 * track font-size cleanly, so letting them size the layout makes the trigger
 * drift out of alignment as the page zooms.
 */
function Flag({ code, className }: { code: string; className?: string }) {
  return (
    <span
      className={cn(
        "flex h-5 w-5 shrink-0 items-center justify-center text-base leading-none",
        className,
      )}
      aria-hidden="true"
    >
      {LANGUAGE_FLAGS[code as Language]}
    </span>
  )
}

export type LanguageSwitcherProps = {
  className?: string
  variant?: LanguageSwitcherVariant
}

/**
 * Language dropdown. The original navigated to a /{lang}/ URL; translations are
 * bundled here, so switching is instant and stays on the page.
 */
export function LanguageSwitcher({
  className,
  variant = "ghost",
}: LanguageSwitcherProps) {
  const { i18n, t } = useTranslation()
  const [open, setOpen] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)

  const close = useCallback(() => setOpen(false), [])
  useClickOutside(containerRef, close, open)

  const current = i18n.resolvedLanguage || i18n.language || "en"

  return (
    <div className={cn("relative", className)} ref={containerRef}>
      <TapButton
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-label={t("common:language.change")}
        title={t("common:language.change")}
        onClick={() => setOpen((value) => !value)}
        className={cn(
          "flex size-9 items-center justify-center rounded-lg transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand lg:size-11 lg:rounded-xl",
          TRIGGER_VARIANTS[variant],
        )}
      >
        {/* The flag alone. The code beside it said the same thing twice, and a
            row of chrome icons is a row of squares — a two-letter label made
            this one the odd width in it. It is drawn at the size the icons
            beside it are: an emoji is inset inside its own glyph box, so
            matching font-size to icon size leaves it visibly the smaller. */}
        <Flag
          code={current}
          className="size-6 text-2xl lg:size-7 lg:text-[1.75rem]"
        />
      </TapButton>

      {open && (
        // The rounding and the scrolling live on different boxes on purpose: an
        // overlay scrollbar is painted over its own element's corners, so the
        // radius has to belong to a parent that clips it.
        //
        // Same surface and hairline as the {@link Select} panel — the two are
        // the same object as far as anyone using them is concerned, and this
        // one floats over the page rather than a dialog, which is the case a
        // fill on its own can't cover.
        <div className="absolute right-0 z-50 mt-2 w-44 overflow-hidden rounded-xl bg-surface-3 shadow-2xl shadow-black/60 ring-1 ring-white/10">
          <ul
            // biome-ignore lint/a11y/noNoninteractiveElementToInteractiveRole: a listbox of rows is a list; the rows themselves are the buttons.
            role="listbox"
            aria-label={t("common:language.select")}
            className="panel-scroll max-h-72 overflow-y-auto p-1"
          >
            {SUPPORTED_LANGUAGES.map((lng) => (
              <li key={lng}>
                <TapButton
                  role="option"
                  aria-selected={lng === current}
                  onClick={() => {
                    changeLanguage(lng)
                    setOpen(false)
                  }}
                  className={cn(
                    "flex w-full items-center gap-2 rounded-md px-3 py-2 text-left text-sm transition",
                    lng === current
                      ? "bg-brand font-semibold text-white"
                      : "text-white/70 hover:bg-surface-5 hover:text-white",
                  )}
                >
                  <Flag code={lng} />
                  {LANGUAGE_NAMES[lng]}
                </TapButton>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  )
}
