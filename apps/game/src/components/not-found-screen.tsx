import { Link, Screen } from "@repo/nativ/components"
import { useTranslation } from "react-i18next"

/**
 * An address that is not one of the game's screens.
 *
 * It leads with the number. "404" is the one thing on this screen that says
 * what happened without being read — anybody who has used the web knows it on
 * sight, in any language — and at this size it is also the only decoration the
 * screen needs. The sentence underneath is for whoever wants the words.
 *
 * The texture is turned inside out here: on every other screen it fades away at
 * the edges, and on a screen whose content is a single block in the middle that
 * puts the densest hexes exactly behind the words.
 */
export function NotFoundScreen() {
  const { t } = useTranslation()

  return (
    <Screen className="relative box-border items-center justify-center bg-ground px-safe-offset-6 py-safe-offset-8 text-center">
      <div className="hex-texture hex-texture-inverted pointer-events-none absolute inset-0 [--hex-size:110px]" />

      <span
        aria-hidden="true"
        className="relative font-display text-[110px] font-extrabold leading-[0.86] tracking-[-0.055em] text-white lg:text-[148px]"
      >
        404
      </span>

      <h1 className="relative mt-[18px] font-display text-[21px] font-bold tracking-[-0.02em] text-white/80">
        {t("common:not_found.title")}
      </h1>

      <p className="relative mt-2.5 max-w-[340px] text-[15px] leading-relaxed text-balance text-muted">
        {t("common:not_found.body")}
      </p>

      <Link
        to="/"
        className="clickable relative mt-[26px] inline-flex h-[50px] items-center justify-center rounded-xl bg-brand px-7 font-display text-base font-semibold text-white no-underline transition-colors duration-200 ease-out hover:bg-brand-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-2 focus-visible:ring-offset-ground"
      >
        {t("common:not_found.action")}
      </Link>
    </Screen>
  )
}

export default NotFoundScreen
