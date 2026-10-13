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
 * Translations are bundled rather than fetched, so switching is instant and
 * stays on the page. The original navigated to a `/{lang}/` URL.
 *
 * It sits in the settings sheet with everything else that is set once. The
 * header carried a bare flag button until this branch, which spent a square of
 * chrome on every screen to say something a player says once.
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
