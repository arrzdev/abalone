import { expect, test } from "@playwright/test"
import { openApp } from "./support/app"
import { expectNoClippedText } from "./support/layout"

// The mode switch on /offline reads in full on the narrowest phone: no label
// is cut short with an ellipsis or clipped by its segment. English, plus the
// longest labels among the other languages. The shared clipped-text check lets
// an ellipsis through, so each label is also measured here.

const NARROWEST_PHONE = { width: 320, height: 640 }

const LABELS = [
  { locale: "en-US", tabs: ["vs Computer", "Pass & Play"] },
  { locale: "de-DE", tabs: ["Gegen Computer", "Zwei Spieler"] },
  { locale: "pt-PT", tabs: ["vs computador", "Dois jogadores"] },
  { locale: "tr-TR", tabs: ["Bilgisayara karşı", "İki oyuncu"] },
]

for (const { locale, tabs } of LABELS) {
  test.describe(`the mode tabs in ${locale} at 320px`, () => {
    test.use({ locale, viewport: NARROWEST_PHONE })

    test("show every label in full", async ({ page }) => {
      await openApp(page, "/offline")
      await expectNoClippedText(page.getByRole("tablist"))

      for (const name of tabs) {
        const tab = page.getByRole("tab", { name })
        await expect(tab).toBeVisible()

        const fit = await tab.evaluate((element) => {
          const label = element.lastElementChild as HTMLElement
          const tabBox = element.getBoundingClientRect()
          const labelBox = label.getBoundingClientRect()
          return {
            text: label.textContent,
            clippedAcross: label.scrollWidth > label.clientWidth,
            clippedDown: label.scrollHeight > label.clientHeight,
            insideTab:
              labelBox.left >= tabBox.left &&
              labelBox.right <= tabBox.right &&
              labelBox.top >= tabBox.top &&
              labelBox.bottom <= tabBox.bottom,
          }
        })

        expect(fit, `${name} fits its tab`).toEqual({
          text: name,
          clippedAcross: false,
          clippedDown: false,
          insideTab: true,
        })
      }
    })
  })
}
