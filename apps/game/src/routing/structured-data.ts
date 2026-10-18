import enGame from "@/i18n/locales/en/game.json"
import type { IndexablePath, SeoPage } from "@/routing/seo-pages"
import { siteUrl } from "@/utils/site"

/**
 * The JSON-LD each indexable page carries (tech-seo-spec item 4 on TUD-626).
 *
 * A search engine reads it as a description of the page, and only trusts it
 * while it says what the page shows. So the payloads are built from the page's
 * own English copy rather than written a second time beside it.
 */

type Json = { [key: string]: Json | Json[] | string | string[] }

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

/** The FAQ items as the page shows them, answers without their link markup. */
function rulesFaq(): Json {
  const items = Object.values(enGame.rules.faq.items)
  return {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: items.map((item) => ({
      "@type": "Question",
      name: item.question,
      acceptedAnswer: { "@type": "Answer", text: plainText(item.answer) },
    })),
  }
}

function article(
  path: "/strategy" | "/opening-moves",
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

/**
 * The JSON-LD for one indexable page. None for the game screen: it is a tool,
 * not a document, and has nothing for a rich result.
 */
export function structuredDataScripts(
  path: IndexablePath,
  page: SeoPage,
): StructuredDataScript[] {
  if (path === "/") return [toScript(videoGame())]
  if (path === "/rules")
    return [toScript(rulesHowTo()), toScript(rulesFaq())]
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
    ]
  }
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
  return []
}
