import type { Language } from "@/i18n/languages"
import { DEFAULT_LANGUAGE, localePath } from "@/i18n/locale-path"
import { localeResources } from "@/i18n/locale-resources"
import enCommon from "@/i18n/locales/en/common.json"
import enGame from "@/i18n/locales/en/game.json"
import type { IndexablePath, SeoPage } from "@/routing/seo-pages"
import { BRAND } from "@/utils/brand"
import { siteUrl } from "@/utils/site"

/**
 * The JSON-LD each indexable page carries (tech-seo-spec item 4 on TUD-626).
 *
 * A search engine reads it as a description of the page, and only trusts it
 * while it says what the page shows. So the payloads are built from the page's
 * own English copy rather than written a second time beside it.
 */

type Json = {
  [key: string]: Json | Json[] | string | string[] | number
}

/** A `<script type="application/ld+json">` in the route head. */
export type StructuredDataScript = {
  type: "application/ld+json"
  children: string
}

const ORGANIZATION = { "@type": "Organization", name: "TUDU" }

/** The day /strategy went live; an article's date is when it was published. */
const STRATEGY_PUBLISHED = "2026-10-11"

/** The day /opening-moves went live. */
const OPENING_MOVES_PUBLISHED = "2026-10-17"

/** The day /starting-positions went live. */
const STARTING_POSITIONS_PUBLISHED = "2026-10-18"

/**
 * The rule sections that are steps of playing, in page order: the section's
 * anchor, its title, and the paragraph its step quotes.
 *
 * One paragraph each, not the whole section: a section is a paragraph, a list
 * and another paragraph, and joined into one string it reads as a sentence the
 * page never shows.
 */
const RULE_STEPS = [
  { id: "goal", copy: enGame.rules.goal, text: enGame.rules.goal.body },
  {
    id: "directions",
    copy: enGame.rules.directions,
    text: enGame.rules.directions.body,
  },
  {
    id: "moving-groups",
    copy: enGame.rules.move,
    text: enGame.rules.move.limit,
  },
  {
    id: "sumito",
    copy: enGame.rules.push,
    text: enGame.rules.push.conditions,
  },
  {
    id: "pushing-off",
    copy: enGame.rules.capture,
    text: enGame.rules.capture.body,
  },
] as const

/** Copy with its `<strong>`-style markup taken out. */
function plainText(copy: string): string {
  return copy.replace(/<[^>]+>/g, "")
}

function videoGame(): Json {
  return {
    "@context": "https://schema.org",
    "@type": "VideoGame",
    name: "Abalone",
    url: siteUrl("/"),
    description:
      "Play the Abalone board game online for free: against the computer, a friend on one device, or an online opponent.",
    genre: "Board game",
    playMode: ["SinglePlayer", "MultiPlayer"],
    applicationCategory: "Game",
    operatingSystem: "Web",
    offers: { "@type": "Offer", price: "0", priceCurrency: "EUR" },
  }
}

function rulesHowTo(): Json {
  return {
    "@context": "https://schema.org",
    "@type": "HowTo",
    name: "How to play Abalone",
    url: siteUrl("/rules"),
    step: RULE_STEPS.map((step) => ({
      "@type": "HowToStep",
      name: step.copy.title,
      url: siteUrl(`/rules#${step.id}`),
      text: plainText(step.text),
    })),
  }
}

function howToPlayHowTo(): Json {
  return {
    "@context": "https://schema.org",
    "@type": "HowTo",
    name: enGame.howto.heading,
    url: siteUrl("/how-to-play"),
    step: Object.entries(enGame.howto.steps)
      .filter(([key]) => key !== "title")
      .map(([key, step]) => {
        const { title, body } = step as { title: string; body: string }
        return {
          "@type": "HowToStep",
          name: title,
          url: siteUrl(`/how-to-play#${key}`),
          text: body,
        }
      }),
  }
}

/** The FAQ items as the page shows them, answers without their link markup. */
function faqPage(
  faq: Record<string, { question: string; answer: string }>,
): Json {
  const items = Object.values(faq)
  return {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: Object.values(items).map((item) => ({
      "@type": "Question",
      name: item.question,
      acceptedAnswer: { "@type": "Answer", text: plainText(item.answer) },
    })),
  }
}

function article(
  path: "/strategy" | "/opening-moves" | "/starting-positions",
  headline: string,
  datePublished: string,
  description: string,
  image: string,
): Json {
  return {
    "@context": "https://schema.org",
    "@type": "Article",
    headline,
    description,
    url: siteUrl(path),
    mainEntityOfPage: siteUrl(path),
    image,
    datePublished,
    author: ORGANIZATION,
    publisher: ORGANIZATION,
  }
}

/**
 * Serialised for the inside of a `<script>`. The router writes it as raw HTML,
 * so a `</script>` in any string would close the tag early; `<` is the
 * same character to a JSON parser and no tag to an HTML one.
 */
function toScript(data: Json): StructuredDataScript {
  return {
    type: "application/ld+json",
    children: JSON.stringify(data).replace(/</g, "\\u003c"),
  }
}

//the nav labels of every language ("Rules", "Regras"): the same words the
//header calls these pages, so the trail in a result matches the site
//of the language in hand: English until that language is loaded in the browser
type NavLocale = { nav?: Record<string, string> }

/** The guides that sit one level under home, and what the trail calls each. */
const GUIDE_NAMES: Partial<
  Record<IndexablePath, (language: Language) => string>
> = {
  "/rules": (language) => navLabel("rules", language),
  "/strategy": (language) => navLabel("strategy", language),
  "/how-to-play": () => enGame.howto.title,
  "/opening-moves": () => enGame.openings.title,
  "/starting-positions": () => enGame.positions.title,
}

function navLabel(key: "rules" | "strategy", language: Language): string {
  return (
    localeResources.resource<NavLocale>(language, "common")?.nav?.[key] ??
    enCommon.nav[key]
  )
}

/**
 * Home, then the page: what a search result shows in place of the bare URL.
 * Only the guides have one; home is the top of the trail, and the game screen
 * and the online landing are not guides.
 *
 * `language` is the one the page is served in, so the second URL is the page's
 * own canonical and the first is the home of the same language.
 */
export function breadcrumbScripts(
  path: IndexablePath,
  language: Language = DEFAULT_LANGUAGE,
): StructuredDataScript[] {
  const name = GUIDE_NAMES[path]
  if (!name) return []
  return [
    toScript({
      "@context": "https://schema.org",
      "@type": "BreadcrumbList",
      itemListElement: [
        {
          "@type": "ListItem",
          position: 1,
          name: BRAND,
          item: siteUrl(localePath("/", language)),
        },
        {
          "@type": "ListItem",
          position: 2,
          name: name(language),
          item: siteUrl(localePath(path, language)),
        },
      ],
    }),
  ]
}

/**
 * The JSON-LD for one indexable page. The game screen is a tool, not a
 * document, so it carries none.
 */
export function structuredDataScripts(
  path: IndexablePath,
  page: SeoPage,
): StructuredDataScript[] {
  if (path === "/")
    return [
      toScript(videoGame()),
      toScript(faqPage(enCommon.home.faq.items)),
    ]
  if (path === "/rules")
    return [
      toScript(rulesHowTo()),
      toScript(faqPage(enGame.rules.faq.items)),
    ]
  if (path === "/strategy") {
    const image = siteUrl(`/images/social/og-${page.image}.jpg`)
    return [
      toScript(
        article(
          path,
          enGame.strategy.heading,
          STRATEGY_PUBLISHED,
          page.description,
          image,
        ),
      ),
      toScript(faqPage(enGame.strategy.faq.items)),
    ]
  }
  if (path === "/how-to-play")
    return [
      toScript(howToPlayHowTo()),
      toScript(faqPage(enGame.howto.faq.items)),
    ]
  if (path === "/opening-moves") {
    const image = siteUrl(`/images/social/og-${page.image}.jpg`)
    return [
      toScript(
        article(
          path,
          enGame.openings.heading,
          OPENING_MOVES_PUBLISHED,
          page.description,
          image,
        ),
      ),
    ]
  }
  if (path === "/play-online")
    return [toScript(faqPage(enGame.playOnline.faq.items))]
  if (path === "/starting-positions") {
    const image = siteUrl(`/images/social/og-${page.image}.jpg`)
    return [
      toScript(
        article(
          path,
          enGame.positions.heading,
          STARTING_POSITIONS_PUBLISHED,
          page.description,
          image,
        ),
      ),
      toScript(faqPage(enGame.positions.faq.items)),
    ]
  }
  //the one path left: /offline
  return []
}
