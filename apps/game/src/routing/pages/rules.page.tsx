import { WINNING_SCORE } from "@repo/abalone-engine/config"
import { HEADING_STEPS } from "@repo/abalone-engine/topology"
import { cn } from "@repo/nativ/utils"
import { createFileRoute, Link } from "@tanstack/react-router"
import type { ReactNode } from "react"
import { Trans, useTranslation } from "react-i18next"
import { MarbleGlyph } from "@/components/marble-glyph"
import { RuleDiagram } from "@/components/rule-diagram"
import { buttonClassName } from "@/components/ui/button"
import { Card, Page, PageTitle } from "@/components/ui/page"
import { SubpageHeader } from "@/components/ui/subpage-header"
import { useMarbleDesign } from "@/hooks/use-marble-design"
import type { Diagram } from "@/render/draw-diagram"
import { seoPageHead } from "@/routing/seo-pages"

export const Route = createFileRoute("/_subpage/rules")({
  head: () => seoPageHead("/rules"),
  component: RulesPage,
})

/**
 * The rules, as positions and as prose.
 *
 * Abalone has about five rules and every one of them is about a shape on the
 * board, which is why the three-line summary that used to sit in the setup panel
 * never taught anyone anything. Each rule here gets the handful of spaces it
 * actually concerns, drawn by the same marble renderer as the real board.
 *
 * The text beside each one states the rule in full (the `rules-text-final`
 * document on TUD-632). This is the page a search for the rules lands on, and a
 * search engine reads sentences, not diagrams.
 */

/** Straight line of three, moving along its own direction into the free space. */
const INLINE: Diagram = {
  cells: ["0,-2", "0,-1", "0,0", "0,1"],
  marbles: { "0,-2": "white", "0,-1": "white", "0,0": "white" },
  arrows: [
    { pos: "0,-2", dir: [0, 1] },
    { pos: "0,-1", dir: [0, 1] },
    { pos: "0,0", dir: [0, 1] },
  ],
  marks: [{ pos: "0,1", kind: "target" }],
}

/** The same three, stepping sideways — every space they land on must be free. */
const BROADSIDE: Diagram = {
  cells: ["0,-1", "0,0", "0,1", "-1,0", "-1,1", "-1,2"],
  marbles: { "0,-1": "white", "0,0": "white", "0,1": "white" },
  arrows: [
    { pos: "0,-1", dir: [-1, 1] },
    { pos: "0,0", dir: [-1, 1] },
    { pos: "0,1", dir: [-1, 1] },
  ],
  marks: [
    { pos: "-1,0", kind: "target" },
    { pos: "-1,1", kind: "target" },
    { pos: "-1,2", kind: "target" },
  ],
}

/** Three against two: the whole line shifts one space. */
const PUSH: Diagram = {
  cells: ["0,-3", "0,-2", "0,-1", "0,0", "0,1", "0,2"],
  marbles: {
    "0,-3": "white",
    "0,-2": "white",
    "0,-1": "white",
    "0,0": "black",
    "0,1": "black",
  },
  arrows: [
    { pos: "0,-3", dir: [0, 1] },
    { pos: "0,-2", dir: [0, 1] },
    { pos: "0,-1", dir: [0, 1] },
    { pos: "0,0", dir: [0, 1] },
    { pos: "0,1", dir: [0, 1] },
  ],
  marks: [{ pos: "0,2", kind: "target" }],
}

/** Three against three: equal numbers never move. */
const BLOCKED: Diagram = {
  cells: ["0,-3", "0,-2", "0,-1", "0,0", "0,1", "0,2", "0,3"],
  marbles: {
    "0,-3": "white",
    "0,-2": "white",
    "0,-1": "white",
    "0,0": "black",
    "0,1": "black",
    "0,2": "black",
  },
  arrows: [
    { pos: "0,-3", dir: [0, 1] },
    { pos: "0,-2", dir: [0, 1] },
    { pos: "0,-1", dir: [0, 1] },
  ],
  marks: [{ pos: "0,3", kind: "blocked" }],
}

/** Two against one at the rim; the faded marble has no space left to land on. */
const CAPTURE: Diagram = {
  cells: ["0,-2", "0,-1", "0,0"],
  marbles: {
    "0,-2": "white",
    "0,-1": "white",
    "0,0": "black",
    "0,1": "black",
  },
  arrows: [
    { pos: "0,-2", dir: [0, 1] },
    { pos: "0,-1", dir: [0, 1] },
    { pos: "0,0", dir: [0, 1] },
  ],
}

/** One marble and the six spaces around it. */
const COMPASS: Diagram = {
  cells: ["0,0", ...HEADING_STEPS.map(([r, q]) => `${r},${q}`)],
  marbles: { "0,0": "white" },
  arrows: HEADING_STEPS.map((dir) => ({
    pos: `${dir[0]},${dir[1]}`,
    dir,
  })),
}

/** Bold inside a rule's text: the word the rule turns on. */
const STRONG = <strong className="font-semibold text-white" />

const TEXT_LINK_CLASS =
  "font-semibold text-brand-light underline underline-offset-2 hover:text-white"

/** A rule's text, with the bold its copy marks. */
function RuleText({ i18nKey }: { i18nKey: string }) {
  return <Trans i18nKey={i18nKey} components={{ strong: STRONG }} />
}

/**
 * One rule: what it says, and the board it says it about.
 *
 * Above `lg` the two sit side by side, the text on the left and the positions
 * on the right. Stacked, a rule is a paragraph and then a picture the length of
 * a screen below it, and by the time the picture is on screen the sentence it
 * illustrates is not.
 *
 * The text takes the smaller share: the diagrams are what a rule about shapes is
 * actually made of. A rule with no diagram has the whole card.
 *
 * `scroll-mt` so a link to the heading (/rules#sumito) does not land it flush
 * against the top of the scroller.
 */
function Rule({
  id,
  title,
  children,
  diagrams,
}: {
  id: string
  title: string
  children: ReactNode
  diagrams?: ReactNode
}) {
  return (
    <Card className="lg:flex lg:items-start lg:gap-x-7">
      <div className={cn("min-w-0", diagrams && "lg:w-[40%] lg:shrink-0")}>
        <h2
          id={id}
          className="scroll-mt-6 text-lg font-bold text-brand-light"
        >
          {title}
        </h2>
        <div className="mt-2 flex flex-col gap-y-2 text-sm leading-relaxed text-subtle">
          {children}
        </div>
      </div>

      {diagrams && <div className="min-w-0 lg:flex-1">{diagrams}</div>}
    </Card>
  )
}

/** The points of a rule that are a list in its copy. */
function RuleList({ children }: { children: ReactNode }) {
  return (
    <ul className="flex list-disc flex-col gap-y-1.5 pl-5 marker:text-faint">
      {children}
    </ul>
  )
}

/** A diagram with the sentence it illustrates directly underneath. */
function Figure({
  diagram,
  caption,
  marbleDesign,
}: {
  diagram: Diagram
  caption: string
  marbleDesign: string
}) {
  return (
    //first in the right-hand column and so already level with the heading; the
    //gap above it belongs to the paragraph it follows, which is no longer above
    <figure className="mt-4 lg:first:mt-0">
      <div className="overflow-hidden rounded-xl bg-well p-2">
        <RuleDiagram
          diagram={diagram}
          marbleDesign={marbleDesign}
          label={caption}
        />
      </div>
      <figcaption className="mt-2 text-center text-xs text-faint">
        {caption}
      </figcaption>
    </figure>
  )
}

/** The three openings the page describes, each a link target of its own. */
const DESCRIBED_SETUPS = [
  ["standard", "standard"],
  ["belgian_daisy", "belgian-daisy"],
  ["german_daisy", "german-daisy"],
] as const

const FAQ_ITEMS = ["diagonal", "single", "own_block", "solved"] as const

function RulesPage() {
  const { t } = useTranslation()

  // The diagrams are the player's own marbles, not a stock illustration.
  const [marbleDesign] = useMarbleDesign()

  return (
    <>
      {/* The page's own heading is on a phone too, so the bar's title is a
          label: one `<h1>` on the page, and it is the one a search shows. */}
      <SubpageHeader title={t("game:rules.title")} titleAs="p" />

      <Page className="lg:max-w-[940px]">
        <PageTitle
          onPhone
          description={
            <Trans
              i18nKey="game:rules.intro"
              components={{
                online: <Link to="/" className={TEXT_LINK_CLASS} />,
                offline: (
                  <Link to="/offline" className={TEXT_LINK_CLASS} />
                ),
              }}
            />
          }
        >
          {t("game:rules.heading")}
        </PageTitle>

        {/* One column, in order. The rules are a sequence — pushing means
            nothing before moving does — and two columns would ask them to be
            read down one side and then down the other. */}
        <div className="flex flex-col gap-y-4">
          <Rule
            id="goal"
            title={t("game:rules.goal.title")}
            diagrams={
              //the win condition at a glance: this is how many have to go
              <div className="flex items-center justify-center gap-2 rounded-xl bg-well py-4 max-lg:mt-4">
                {Array.from({ length: WINNING_SCORE }, (_, i) => (
                  <MarbleGlyph
                    // biome-ignore lint/suspicious/noArrayIndexKey: six identical marbles standing for a count, not a list of things.
                    key={i}
                    color="black"
                    design={marbleDesign}
                    size={24}
                  />
                ))}
              </div>
            }
          >
            <p>
              <RuleText i18nKey="game:rules.goal.body" />
            </p>
          </Rule>

          <Rule id="turns" title={t("game:rules.turns.title")}>
            <p>
              <RuleText i18nKey="game:rules.turns.body" />
            </p>
          </Rule>

          <Rule
            id="directions"
            title={t("game:rules.directions.title")}
            diagrams={
              <Figure
                diagram={COMPASS}
                caption={t("game:rules.directions.caption")}
                marbleDesign={marbleDesign}
              />
            }
          >
            <p>
              <RuleText i18nKey="game:rules.directions.body" />
            </p>
          </Rule>

          <Rule
            id="moving-groups"
            title={t("game:rules.move.title")}
            diagrams={
              <>
                <Figure
                  diagram={INLINE}
                  caption={t("game:rules.move.inline_caption")}
                  marbleDesign={marbleDesign}
                />
                <Figure
                  diagram={BROADSIDE}
                  caption={t("game:rules.move.broadside_caption")}
                  marbleDesign={marbleDesign}
                />
              </>
            }
          >
            <p>
              <RuleText i18nKey="game:rules.move.body" />
            </p>
            <RuleList>
              <li>
                <RuleText i18nKey="game:rules.move.inline" />
              </li>
              <li>
                <RuleText i18nKey="game:rules.move.broadside" />
              </li>
            </RuleList>
            <p>
              <RuleText i18nKey="game:rules.move.limit" />
            </p>
          </Rule>

          <Rule
            id="sumito"
            title={t("game:rules.push.title")}
            diagrams={
              <>
                <Figure
                  diagram={PUSH}
                  caption={t("game:rules.push.ok_caption")}
                  marbleDesign={marbleDesign}
                />
                <Figure
                  diagram={BLOCKED}
                  caption={t("game:rules.push.blocked_caption")}
                  marbleDesign={marbleDesign}
                />
              </>
            }
          >
            <p>
              <RuleText i18nKey="game:rules.push.body" />
            </p>
            <RuleList>
              <li>{t("game:rules.push.ratios.two_one")}</li>
              <li>{t("game:rules.push.ratios.three_one")}</li>
              <li>{t("game:rules.push.ratios.three_two")}</li>
            </RuleList>
            <p>
              <RuleText i18nKey="game:rules.push.conditions" />
            </p>
          </Rule>

          <Rule
            id="pushing-off"
            title={t("game:rules.capture.title")}
            diagrams={
              <Figure
                diagram={CAPTURE}
                caption={t("game:rules.capture.caption")}
                marbleDesign={marbleDesign}
              />
            }
          >
            <p>
              <RuleText i18nKey="game:rules.capture.body" />
            </p>
          </Rule>

          <Rule id="how-to-win" title={t("game:rules.win.title")}>
            <p>
              <RuleText i18nKey="game:rules.win.body" />
            </p>
          </Rule>

          <Rule
            id="starting-positions"
            title={t("game:rules.setups.title")}
          >
            <p>{t("game:rules.setups.body")}</p>
            <RuleList>
              {DESCRIBED_SETUPS.map(([key, anchor]) => (
                <li key={key}>
                  <Trans
                    i18nKey={`game:rules.setups.${key}`}
                    components={{
                      name: (
                        <strong
                          id={anchor}
                          className="scroll-mt-6 font-semibold text-white"
                        />
                      ),
                    }}
                  />
                </li>
              ))}
              <li>
                <RuleText i18nKey="game:rules.setups.others" />
              </li>
            </RuleList>
          </Rule>

          <Rule id="faq" title={t("game:rules.faq.title")}>
            <dl className="flex flex-col gap-y-3">
              {FAQ_ITEMS.map((item) => (
                <div key={item}>
                  <dt className="font-semibold text-white">
                    {t(`game:rules.faq.items.${item}.question`)}
                  </dt>
                  <dd className="mt-0.5">
                    {t(`game:rules.faq.items.${item}.answer`)}
                  </dd>
                </div>
              ))}
            </dl>
          </Rule>
        </div>

        {/* Full width on a phone, where full width is a thumb's width. Across
            two columns they would be buttons as wide as the page, so above `lg`
            they take the room they need and sit in the middle of what they
            follow. Links rather than buttons: they go somewhere, and a crawler
            follows an `href`. */}
        <div className="flex flex-col gap-3 lg:flex-row lg:justify-center">
          <Link
            to="/"
            className={cn(
              buttonClassName("primary", "lg"),
              "w-full lg:w-auto lg:px-12",
            )}
          >
            {t("game:rules.cta")}
          </Link>
          <Link
            to="/offline"
            className={cn(
              buttonClassName("secondary", "lg"),
              "w-full lg:w-auto lg:px-12",
            )}
          >
            {t("game:rules.cta_computer")}
          </Link>
        </div>
      </Page>
    </>
  )
}
