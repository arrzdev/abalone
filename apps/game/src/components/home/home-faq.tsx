import { useTranslation } from "react-i18next"
import { FaqList } from "@/components/manual/faq-list"
import { DEFAULT_LANGUAGE } from "@/i18n/locale-path"

const FAQ_ITEMS = ["free", "account", "computer", "one_device"] as const

/**
 * The questions a search for "play abalone free" brings, under the poster. The
 * home page's FAQPage markup is built from the same copy (`structured-data.ts`).
 *
 * English only, like that markup: the copy has no translations yet, and an
 * English section under a translated poster reads as a broken page.
 */
export function HomeFaq() {
  const { t, i18n } = useTranslation()

  if (i18n.language !== DEFAULT_LANGUAGE) return null

  return (
    <section
      aria-labelledby="home-faq"
      className="relative mx-auto w-full max-w-2xl shrink-0 px-4 pt-10 pb-safe-offset-10 text-muted lg:px-12"
    >
      <h2
        id="home-faq"
        className="mb-5 text-2xl font-bold tracking-tight text-white"
      >
        {t("common:home.faq.title")}
      </h2>
      <FaqList
        items={FAQ_ITEMS.map((item) => ({
          id: item,
          question: t(`common:home.faq.items.${item}.question`),
          answer: t(`common:home.faq.items.${item}.answer`),
        }))}
      />
    </section>
  )
}
