import { useTranslation } from "react-i18next"
import { FaqList } from "@/components/manual/faq-list"

const FAQ_ITEMS = ["free", "account", "computer", "one_device"] as const

/**
 * The questions a search for "play abalone free" brings, under the poster. The
 * home page's FAQPage markup is built from the same copy (`structured-data.ts`).
 */
export function HomeFaq() {
  const { t } = useTranslation()

  return (
    <section
      aria-labelledby="home-faq"
      className="relative mx-auto w-full max-w-2xl px-4 pt-10 pb-safe-offset-10 text-muted lg:px-12"
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
