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

export const Route = createFileRoute("/_subpage/rules")({
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

function Rule({
  title,
  children,
}: {
  title: string
  children: ReactNode
}) {
  return (
    <Card>
      <h2 className="text-lg font-bold text-brand-light">{title}</h2>
      {children}
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
    <figure className="mt-4">
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

      <Page>
        <PageTitle description={t("game:rules.intro")}>
          {t("game:rules.title")}
        </PageTitle>

        <div className="flex flex-col gap-y-4">
          <Rule title={t("game:rules.goal.title")}>
            <p className="mt-2 text-sm leading-relaxed text-subtle">
              {t("game:rules.goal.body")}
            </p>
            {/* The win condition at a glance: this is how many have to go. */}
            <div className="mt-4 flex items-center justify-center gap-2 rounded-xl bg-well py-4">
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

          <Rule title={t("game:rules.directions.title")}>
            <p className="mt-2 text-sm leading-relaxed text-subtle">
              {t("game:rules.directions.body")}
            </p>
            <Figure
              diagram={COMPASS}
              caption={t("game:rules.directions.caption")}
              marbleDesign={marbleDesign}
            />
          </Rule>

          <Rule title={t("game:rules.move.title")}>
            <p className="mt-2 text-sm leading-relaxed text-subtle">
              {t("game:rules.move.body")}
            </p>
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

          <Rule title={t("game:rules.push.title")}>
            <p className="mt-2 text-sm leading-relaxed text-subtle">
              {t("game:rules.push.body")}
            </p>
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

          <Rule title={t("game:rules.capture.title")}>
            <p className="mt-2 text-sm leading-relaxed text-subtle">
              {t("game:rules.capture.body")}
            </p>
            <Figure
              diagram={CAPTURE}
              caption={t("game:rules.capture.caption")}
              marbleDesign={marbleDesign}
            />
          </Rule>
        </div>

        <Button
          variant="primary"
          size="lg"
          className="w-full"
          onClick={() => navigate({ to: "/game/offline" })}
        >
          {t("game:rules.cta")}
        </Button>
      </Page>
    </>
  )
}
