import { Link } from "@tanstack/react-router"
import { Trans, useTranslation } from "react-i18next"

/** The three bands of bots, weakest first. */
const STRENGTHS = ["low", "middle", "high"] as const

const TIPS = [
  "center",
  "touching",
  "rim",
  "overextend",
  "ahead",
  "learn",
] as const

/** In copy order, which is also the order the FAQPage JSON-LD reads them in. */
const FAQ_ITEMS = [
  "free",
  "beat",
  "levels",
  "same_device",
  "random",
  "offline",
] as const

const STRONG = <strong className="font-semibold text-white" />

const TEXT_LINK_CLASS =
  "font-semibold text-brand-light underline underline-offset-2 hover:text-white"

const HEADING_CLASS = "mb-2 font-bold text-white"

/**
 * What a search for "abalone vs computer" lands on (the `offline-copy` document
 * on TUD-1690): who the bots are, how to beat them, Pass & Play and a FAQ.
 *
 * At the tail of the setup panel, under every option and over the pinned Play
 * button, so a player who came to play never scrolls past it and a reader who
 * came to read finds it where the options end. The same in both modes: the copy
 * covers both, and a crawler only ever sees the first.
 *
 * Every claim about a bot maps to a trait in `ai/profiles.ts`; change one and
 * this copy is the other place to change.
 *
 * Selectable, unlike the rest of the board screen: this is text to be read and
 * quoted, not a surface a drag is aimed at.
 */
export function OfflineAbout() {
  const { t } = useTranslation()

  return (
    <div className="space-y-6 border-t border-white/5 pt-6 text-sm leading-relaxed text-muted select-text">
      <p>{t("game:offline.intro")}</p>

      <section>
        <h2 className={HEADING_CLASS}>
          {t("game:offline.strength.title")}
        </h2>
        <p>{t("game:offline.strength.intro")}</p>
        <ul className="mt-2 flex list-disc flex-col gap-y-1.5 pl-5 marker:text-faint">
          {STRENGTHS.map((band) => (
            <li key={band}>
              <Trans
                i18nKey={`game:offline.strength.${band}`}
                components={{ strong: STRONG }}
              />
            </li>
          ))}
        </ul>
      </section>

      <section>
        <h2 className={HEADING_CLASS}>{t("game:offline.beat.title")}</h2>
        <ol className="flex list-decimal flex-col gap-y-1.5 pl-5 marker:text-faint">
          {TIPS.map((tip) => (
            <li key={tip}>
              <Trans
                i18nKey={`game:offline.beat.tips.${tip}`}
                components={{ strong: STRONG }}
              />
            </li>
          ))}
        </ol>
        <p className="mt-2">
          <Trans
            i18nKey="game:offline.beat.more"
            components={{
              strategy: (
                <Link to="/strategy" className={TEXT_LINK_CLASS} />
              ),
              openings: (
                <Link to="/opening-moves" className={TEXT_LINK_CLASS} />
              ),
            }}
          />
        </p>
      </section>

      <section>
        <h2 className={HEADING_CLASS}>{t("game:offline.local.title")}</h2>
        <p>
          <Trans
            i18nKey="game:offline.local.body"
            components={{
              online: <Link to="/online" className={TEXT_LINK_CLASS} />,
            }}
          />
        </p>
      </section>

      <section>
        <h2 className={HEADING_CLASS}>{t("game:offline.faq.title")}</h2>
        <dl className="flex flex-col">
          {FAQ_ITEMS.map((item) => (
            <div
              key={item}
              className="border-t border-white/5 py-3 first:border-t-0 first:pt-0 last:pb-0"
            >
              <dt className="font-semibold text-foreground">
                {t(`game:offline.faq.items.${item}.question`)}
              </dt>
              <dd className="mt-1">
                {t(`game:offline.faq.items.${item}.answer`)}
              </dd>
            </div>
          ))}
        </dl>
      </section>
    </div>
  )
}
