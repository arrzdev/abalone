import { cn } from "@repo/nativ/utils"
import { useCallback, useRef, useState } from "react"
import { useTranslation } from "react-i18next"
import type { SelectOption } from "@/components/ui/select"
import { Select } from "@/components/ui/select"
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
function Flag({ code }: { code: string }) {
  return (
    <span
      className="flex h-5 w-5 shrink-0 items-center justify-center text-base leading-none"
      aria-hidden="true"
    >
      {LANGUAGE_FLAGS[code as Language]}
    </span>
  )
}

/** Every language as a Select option, with its flag alongside the native name. */
const LANGUAGE_OPTIONS: SelectOption<Language>[] = SUPPORTED_LANGUAGES.map(
  (lng) => ({
    value: lng,
    label: LANGUAGE_NAMES[lng],
    icon: <Flag code={lng} />,
  }),
)

/**
 * The same choice as {@link LanguageSwitcher}, as a labelled full-width
 * dropdown. This is the form used inside the settings dialog, where a bare flag
 * button would read as decoration rather than as a setting.
 */
export function LanguageSelect({ className }: { className?: string }) {
  const { i18n, t } = useTranslation()
  const current = (i18n.resolvedLanguage ||
    i18n.language ||
    "en") as Language

  return (
    <Select
      label={t("common:language.select")}
      value={current}
      onChange={changeLanguage}
      options={LANGUAGE_OPTIONS}
      className={className}
    />
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
          "flex h-9 items-center gap-2 rounded-lg px-2.5 transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand",
          TRIGGER_VARIANTS[variant],
        )}
      >
        <Flag code={current} />
        <span className="text-sm leading-none font-semibold tracking-wide">
          {current.toUpperCase()}
        </span>
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
