import { useRouter } from "@tanstack/react-router"
import { useTranslation } from "react-i18next"
import { LanguageFlag } from "@/components/language-flag"
import type { SelectOption } from "@/components/ui/select"
import { Select } from "@/components/ui/select"
import type { Language } from "@/i18n"
import {
  changeLanguage,
  LANGUAGE_NAMES,
  SUPPORTED_LANGUAGES,
} from "@/i18n"
import { localePath } from "@/i18n/locale-path"

/** Every language as a Select option, with its flag alongside the native name. */
const LANGUAGE_OPTIONS: SelectOption<Language>[] = SUPPORTED_LANGUAGES.map(
  (lng) => ({
    value: lng,
    label: LANGUAGE_NAMES[lng],
    icon: <LanguageFlag language={lng} />,
  }),
)

/**
 * The language choice, as a labelled full-width dropdown.
 *
 * Translations are bundled rather than fetched, so the text switches at once.
 * The page then moves to its address in that language (`/pt/rules`; English is
 * the unprefixed one), so the address, the head and a reload all agree with
 * what is on screen. It replaces the entry rather than adding one: back should
 * leave the page, not undo a language.
 *
 * It sits in the settings sheet with everything else that is set once. The
 * header carried a bare flag button until this branch, which spent a square of
 * chrome on every screen to say something a player says once.
 */
export function LanguageSelect({ className }: { className?: string }) {
  const { i18n, t } = useTranslation()
  const router = useRouter()
  const current = (i18n.resolvedLanguage ||
    i18n.language ||
    "en") as Language

  function handleChange(language: Language) {
    changeLanguage(language)
    //the router's location is the page without its prefix, as the routes spell it
    const { pathname, searchStr, hash } = router.state.location
    const suffix = `${searchStr}${hash ? `#${hash}` : ""}`
    router.history.replace(`${localePath(pathname, language)}${suffix}`)
  }

  return (
    <Select
      label={t("common:language.select")}
      value={current}
      onChange={handleChange}
      options={LANGUAGE_OPTIONS}
      className={className}
    />
  )
}
