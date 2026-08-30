import { WINNING_SCORE } from "@repo/abalone-engine/config"
import { HEADING_STEPS } from "@repo/abalone-engine/topology"
import { createFileRoute, useNavigate } from "@tanstack/react-router"
import type { ReactNode } from "react"
import { useTranslation } from "react-i18next"
import { MarbleGlyph } from "@/components/marble-glyph"
import { RuleDiagram } from "@/components/rule-diagram"
import { Button } from "@/components/ui/button"
import { Card, Page, PageTitle } from "@/components/ui/page"
import { SubpageHeader } from "@/components/ui/subpage-header"
import { useMarbleDesign } from "@/hooks/use-marble-design"
import type { Diagram } from "@/render/draw-diagram"
import { pageHead } from "@/routing/page-head"

export const Route = createFileRoute("/_subpage/rules")({
  head: () =>
    pageHead({
      title: "Rules",
      description:
        "Every rule of Abalone as a position on the board: how a line moves, how a push works, and how a marble goes off.",
      path: "/rules",
      image: "rules",
    }),
  component: RulesPage,
})

/**
 * The rules, as positions rather than prose.
 *
 * Abalone has about five rules and every one of them is about a shape on the
 * board, which is why the three-line summary that used to sit in the setup panel
 * never taught anyone anything. Each rule here gets the handful of spaces it
 * actually concerns, drawn by the same marble renderer as the real board.
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

/**
 * One rule: what it says, and the board it says it about.
 *
 * Above `lg` the two sit side by side, the sentence on the left and the
 * positions on the right. Stacked, a rule is a paragraph and then a picture the
 * length of a screen below it, and by the time the picture is on screen the
 * sentence it illustrates is not.
 *
 * The text takes the smaller share. It is two lines at that width, and the
 * diagrams are what a rule about shapes is actually made of.
 */
function Rule({
  title,
  body,
  children,
}: {
  title: string
  body: string
  children?: ReactNode
}) {
  return (
    <Card className="lg:flex lg:items-start lg:gap-x-7">
      <div className="lg:w-[36%] lg:shrink-0">
        <h2 className="text-lg font-bold text-brand-light">{title}</h2>
        <p className="mt-2 text-sm leading-relaxed text-subtle">{body}</p>
      </div>

      {children && <div className="min-w-0 lg:flex-1">{children}</div>}
    </Card>
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

function RulesPage() {
  const { t } = useTranslation()
  const navigate = useNavigate()

  // The diagrams are the player's own marbles, not a stock illustration.
  const [marbleDesign] = useMarbleDesign()

  return (
    <>
      <SubpageHeader title={t("game:rules.title")} />

      <Page className="lg:max-w-[940px]">
        <PageTitle description={t("game:rules.intro")}>
          {t("game:rules.title")}
        </PageTitle>

        {/* One column, in order. The five rules are a sequence — pushing means
            nothing before moving does — and two columns would ask them to be
            read down one side and then down the other. */}
        <div className="flex flex-col gap-y-4">
          <Rule
            title={t("game:rules.goal.title")}
            body={t("game:rules.goal.body")}
          >
            {/* The win condition at a glance: this is how many have to go. */}
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
          </Rule>

          <Rule
            title={t("game:rules.directions.title")}
            body={t("game:rules.directions.body")}
          >
            <Figure
              diagram={COMPASS}
              caption={t("game:rules.directions.caption")}
              marbleDesign={marbleDesign}
            />
          </Rule>

          <Rule
            title={t("game:rules.move.title")}
            body={t("game:rules.move.body")}
          >
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
          </Rule>

          <Rule
            title={t("game:rules.push.title")}
            body={t("game:rules.push.body")}
          >
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
          </Rule>

          <Rule
            title={t("game:rules.capture.title")}
            body={t("game:rules.capture.body")}
          >
            <Figure
              diagram={CAPTURE}
              caption={t("game:rules.capture.caption")}
              marbleDesign={marbleDesign}
            />
          </Rule>
        </div>

        {/* Full width on a phone, where full width is a thumb's width. Across
            two columns it would be a button as wide as the page, so above `lg`
            it takes the room it needs and sits in the middle of what it
            follows. */}
        <Button
          variant="primary"
          size="lg"
          className="w-full lg:w-auto lg:self-center lg:px-12"
          onClick={() => navigate({ to: "/offline" })}
        >
          {t("game:rules.cta")}
        </Button>
      </Page>
    </>
  )
}
