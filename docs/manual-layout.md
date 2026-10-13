# Rules and strategy: the manual layout

`/rules` and `/strategy` read as a printed game manual: numbered chapters with
no cards, a contents rail on a desktop, a contents list on a phone, and the
diagrams on dark plates beside the text. The full spec (references, tokens,
type scale, spacing, states) is the `rules-redesign` document on TUD-893; the
build is TUD-910. This file keeps what the code and tests depend on.

## Building blocks

New components live in `apps/game/src/components/manual/` and replace `Page`,
`PageTitle`, `Card`, `Rule` and `Section` on these two pages only.

| Component | Job |
|---|---|
| `ManualPage` | Grid, rail, phone contents list. `rail | text | plate` up to 1200px on `/rules`; `rail | text` up to 960px on `/strategy`. |
| `ManualHero` | H1, intro, the first `PlayBlock`; on `/rules` a plate with the whole board (`START`). |
| `Chapter` | Hairline on top, numeral, H2, body; its plate sticky beside it at `lg`. |
| `Plate` | The dark surface a diagram sits on. |
| `ChapterRail` | Desktop (`lg` and up). Scroll-spy, smooth scroll, a sliding bar. |
| `ContentsList` | Below `lg`. One link per chapter, each row at least 44px tall. |
| `ChapterBreak` | The middle `PlayBlock`, as a band between chapters. |

## Hooks the tests read

`e2e/manual-layout.spec.ts` reads these, not class names:

| Hook | On |
|---|---|
| `data-chapter` | each chapter; its `h2[id]` stays the link target (`/rules#sumito`) |
| `data-chapter-number` | the numeral before the H2, `aria-hidden="true"`, printed `01`…`09` |
| `data-plate` | the plate; `position: sticky` beside a chapter at `lg` |
| `nav[data-manual-rail]` | the rail; the current link has `aria-current="location"` |
| `data-rail-bar` | the one bar that marks the current link; `transition-duration` 0.2s, 0s under reduced motion |
| `nav[data-manual-contents]` | the phone and tablet contents list, after the hero's play block |

The page still scrolls inside `main [data-scroll-view]`; scroll-spy observes
headings inside that scroller (`rootMargin: "0px 0px -70% 0px"`).

## Deep links (TUD-933)

A link to a chapter (`/rules#sumito`) is followed by the browser on the server
rendered markup, before hydration and before any canvas is drawn. So everything
above a chapter has its final size in that markup: a diagram's box reserves its
height (an aspect ratio or a fixed size), not the canvas drawn into it later.
The heading lands at its `scroll-margin-top` (40px on a desktop) once and does
not move; nothing re-scrolls after load. The e2e test samples the heading on
every frame from the first one and sums the page's `layout-shift` entries
(under 0.01) on `/rules` and `/strategy`.

## Decisions (TUD-910)

- **Tip numbers.** The strategy tip titles carry their number in the copy
  ("1. Control the center"). `splitChapterNumber` takes it off and the page
  prints it once, in the numeral column, like the rules. The H2 is the words
  only. A unit test checks every locale's seven titles start with 1…7.
- **Whole-board diagram.** `START` (`apps/game/src/render/start-diagram.ts`)
  is the 61 squares with the standard opening from `@repo/abalone-engine`. At
  `RuleDiagram`'s 260px cap a square is about 19px across, and a 280px-wide
  plate on a 320 phone gives about the same, so the plate shows on phones too.
- Text and i18n keys do not change. The hero plate is a seventh `<figure>`.
