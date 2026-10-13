import { WINNING_SCORE } from "@repo/abalone-engine/config"
import { HEADING_STEPS } from "@repo/abalone-engine/topology"
import { createFileRoute, Link } from "@tanstack/react-router"
import type { ReactNode } from "react"
import { Trans, useTranslation } from "react-i18next"
import type { ManualChapter } from "@/components/manual/chapter"
import { Chapter, ChapterBreak, Plate } from "@/components/manual/chapter"
import { formatChapterNumber } from "@/components/manual/chapter-number"
import { ManualHero, ManualPage } from "@/components/manual/manual-page"
import { MarbleGlyph } from "@/components/marble-glyph"
import { PlayBlock } from "@/components/play-block"
import { RuleDiagram } from "@/components/rule-diagram"
import { SubpageHeader } from "@/components/ui/subpage-header"
import { useMarbleDesign } from "@/hooks/use-marble-design"
import { COMPUTER_GAME } from "@/hooks/use-play-actions"
import type { Diagram } from "@/render/draw-diagram"
import { START } from "@/render/start-diagram"
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
    <figure>
      <div className="overflow-hidden rounded-xl bg-well p-2">
        <RuleDiagram
          diagram={diagram}
          marbleDesign={marbleDesign}
          label={caption}
        />
      </div>
      <figcaption className="mt-2 text-sm leading-normal text-muted">
        {caption}
      </figcaption>
    </figure>
  )
}

/** The chapters in reading order: anchor, then the copy key of its title. */
const CHAPTERS = [
  ["goal", "goal"],
  ["turns", "turns"],
  ["directions", "directions"],
  ["moving-groups", "move"],
  ["sumito", "push"],
  ["pushing-off", "capture"],
  ["how-to-win", "win"],
  ["starting-positions", "setups"],
  ["faq", "faq"],
] as const

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

  const chapters: ManualChapter[] = CHAPTERS.map(([id, key], index) => ({
    id,
    title: t(`game:rules.${key}.title`),
    number: formatChapterNumber(index + 1),
  }))
  const chapter = Object.fromEntries(
    chapters.map((entry) => [entry.id, entry]),
  ) as Record<(typeof CHAPTERS)[number][0], ManualChapter>

  const playBlock = (
    <PlayBlock
      cta={t("game:rules.play.cta")}
      more={t("game:rules.play.more")}
    />
  )

  return (
    <>
      {/* The page's own heading is on a phone too, so the bar's title is a
          label: one `<h1>` on the page, and it is the one a search shows. */}
      <SubpageHeader title={t("game:rules.title")} titleAs="p" />

      {/* One column of chapters, in order. The rules are a sequence — pushing
          means nothing before moving does — and two columns would ask them to
          be read down one side and then down the other. */}
      <ManualPage
        title={t("game:rules.title")}
        chapters={chapters}
        plates
        hero={
          <ManualHero
            heading={t("game:rules.heading")}
            intro={
              <Trans
                i18nKey="game:rules.intro"
                components={{
                  //both open the computer game: playing it in the browser is
                  //playing Abalone online, in the sense the phrase is searched
                  online: (
                    <Link {...COMPUTER_GAME} className={TEXT_LINK_CLASS} />
                  ),
                  offline: (
                    <Link {...COMPUTER_GAME} className={TEXT_LINK_CLASS} />
                  ),
                }}
              />
            }
            //a way to the board under the intro, halfway down and at the end,
            //for whoever has read enough at any of the three
            actions={playBlock}
            //the board the first chapter's words are about, before any of
            //them: a figure with no caption, its label is the whole of it
            plate={
              <Plate>
                <figure>
                  <RuleDiagram
                    diagram={START}
                    marbleDesign={marbleDesign}
                    label={t("game:rules.setups.title")}
                  />
                </figure>
              </Plate>
            }
          />
        }
      >
        <Chapter
          {...chapter.goal}
          //as tall as the text beside it: a count, not a diagram to keep in
          //view while a long chapter scrolls (rules-redesign §5)
          plateClassName="lg:self-stretch lg:pb-16"
          plate={
            //the win condition at a glance: this is how many have to go
            <Plate className="flex-row flex-wrap items-center justify-center gap-3 py-8 lg:h-full lg:py-10">
              {Array.from({ length: WINNING_SCORE }, (_, i) => (
                <MarbleGlyph
                  // biome-ignore lint/suspicious/noArrayIndexKey: six identical marbles standing for a count, not a list of things.
                  key={i}
                  color="black"
                  design={marbleDesign}
                  size={32}
                />
              ))}
            </Plate>
          }
        >
          <p>
            <RuleText i18nKey="game:rules.goal.body" />
          </p>
        </Chapter>

        <Chapter {...chapter.turns}>
          <p>
            <RuleText i18nKey="game:rules.turns.body" />
          </p>
        </Chapter>

        <Chapter
          {...chapter.directions}
          plate={
            <Plate>
              <Figure
                diagram={COMPASS}
                caption={t("game:rules.directions.caption")}
                marbleDesign={marbleDesign}
              />
            </Plate>
          }
        >
          <p>
            <RuleText i18nKey="game:rules.directions.body" />
          </p>
        </Chapter>

        <Chapter
          {...chapter["moving-groups"]}
          plate={
            <Plate>
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
            </Plate>
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
        </Chapter>

        <Chapter
          {...chapter.sumito}
          plate={
            <Plate>
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
            </Plate>
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
        </Chapter>

        <Chapter
          {...chapter["pushing-off"]}
          plate={
            <Plate>
              <Figure
                diagram={CAPTURE}
                caption={t("game:rules.capture.caption")}
                marbleDesign={marbleDesign}
              />
            </Plate>
          }
        >
          <p>
            <RuleText i18nKey="game:rules.capture.body" />
          </p>
        </Chapter>

        <ChapterBreak>{playBlock}</ChapterBreak>

        <Chapter {...chapter["how-to-win"]}>
          <p>
            <RuleText i18nKey="game:rules.win.body" />
          </p>
        </Chapter>

        <Chapter {...chapter["starting-positions"]}>
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
        </Chapter>

        <Chapter {...chapter.faq}>
          <dl className="flex flex-col">
            {FAQ_ITEMS.map((item) => (
              <div
                key={item}
                className="border-t border-border py-4 first:border-t-0 first:pt-0 last:pb-0"
              >
                <dt className="text-[17px] font-semibold text-foreground">
                  {t(`game:rules.faq.items.${item}.question`)}
                </dt>
                {/* A paragraph, because that is what an answer is: the
                    strategy link in one is part of its sentence, the height
                    of its line, not a control standing on its own. */}
                <dd className="mt-1">
                  <p>
                    <Trans
                      i18nKey={`game:rules.faq.items.${item}.answer`}
                      components={{
                        strategy: (
                          <Link
                            to="/strategy"
                            className={TEXT_LINK_CLASS}
                          />
                        ),
                      }}
                    />
                  </p>
                </dd>
              </div>
            ))}
          </dl>
        </Chapter>

        <div className="border-t border-border pt-10 lg:pt-16">
          {playBlock}
        </div>
      </ManualPage>
    </>
  )
}
