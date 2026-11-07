import { useTranslation } from "react-i18next"
import { LANGUAGE_NAMES } from "@/i18n/languages"
import { DEFAULT_LANGUAGE, localePath } from "@/i18n/locale-path"
import type { IndexablePath } from "@/routing/seo-pages"
import { PAGE_LANGUAGES } from "@/routing/seo-pages"

/**
 * The other language versions of a page, as plain links in its served HTML.
 * `hreflang` in the head says which URLs are versions of each other; it does
 * not get them crawled, so without a link a crawler never finds `/pt` from `/`.
 *
 * Plain `<a href>` and not the router's `<Link>`: the locale rewrite puts the
 * current prefix back on a `<Link>`, and these leave it. Each is named in its
 * own language (an endonym), so there is no copy to translate. A page that is
 * in one language only renders nothing.
 */
export function LanguageVersions({
  path,
  className,
}: {
  path: IndexablePath
  className?: string
}) {
  const { t, i18n } = useTranslation()
  const languages = PAGE_LANGUAGES[path]
  //a page that is not in the URL's language is served as the English one
  const current = languages.includes(i18n.language as never)
    ? i18n.language
    : DEFAULT_LANGUAGE
  const others = languages.filter((language) => language !== current)

  if (others.length === 0) return null

  return (
    <nav
      data-language-versions
      aria-label={t("common:language.select")}
      className={className}
    >
      <ul className="-mx-2 flex flex-wrap text-sm text-muted">
        {others.map((language) => (
          <li key={language}>
            <a
              href={localePath(path, language)}
              lang={language}
              hrefLang={language}
              className="inline-flex min-h-11 min-w-11 items-center justify-center px-2 underline-offset-2 hover:text-white hover:underline"
            >
              {LANGUAGE_NAMES[language]}
            </a>
          </li>
        ))}
      </ul>
    </nav>
  )
}
