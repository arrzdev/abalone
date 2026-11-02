import { Link } from "@tanstack/react-router"
import { useTranslation } from "react-i18next"

/** The guides, in reading order, each named by its page's own heading. */
const GUIDES = [
  ["/rules", "game:rules.heading"],
  ["/strategy", "game:strategy.heading"],
  ["/opening-moves", "game:openings.heading"],
  ["/starting-positions", "game:positions.heading"],
] as const

export type GuidePath = (typeof GUIDES)[number][0]

/**
 * The other guides, at the end of a guide: a reader who finished one finds the
 * next, and a crawler finds every guide from each of them. Plain links, which
 * the router gives the page's language prefix (/de/strategy). After the last
 * chapter and outside it, so the way to the board above stays where it was.
 */
export function RelatedGuides({ current }: { current: GuidePath }) {
  const { t } = useTranslation()

  return (
    <nav
      data-related-guides
      aria-labelledby="related-guides"
      className="border-t border-border pt-10 lg:pt-16"
    >
      <h2
        id="related-guides"
        className="font-display text-2xl leading-[1.2] font-bold text-balance text-foreground lg:text-[30px] lg:leading-[1.15]"
      >
        {t("game:related_guides")}
      </h2>
      <ul className="mt-4 max-w-[62ch]">
        {GUIDES.filter(([path]) => path !== current).map(([path, key]) => (
          <li
            key={path}
            className="border-t border-border first:border-t-0"
          >
            <Link
              to={path}
              className="flex min-h-11 items-center py-2 text-base font-semibold text-brand-light underline-offset-2 hover:text-white hover:underline"
            >
              {t(key)}
            </Link>
          </li>
        ))}
      </ul>
    </nav>
  )
}
