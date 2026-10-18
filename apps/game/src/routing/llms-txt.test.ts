import { describe, expect, it } from "vitest"
import { llmsTxt } from "@/routing/llms-txt"
import { SEO_PAGES } from "@/routing/seo-pages"

describe("llmsTxt", () => {
  const text = llmsTxt()

  //the llms.txt shape: an H1 with the name, then a one-line summary as a quote
  it("opens with the site name and the home page title as its summary", () => {
    const [heading, , summary] = text.split("\n")

    expect(heading).toBe("# Abalone")
    expect(summary).toBe(`> ${SEO_PAGES["/"].title}`)
  })

  it("says what the site offers: free, in the browser, no sign-up, three ways to play", () => {
    expect(text).toMatch(/free/i)
    expect(text).toMatch(/browser/i)
    expect(text).toMatch(/no sign-up/i)
    expect(text).toMatch(/computer/i)
    expect(text).toMatch(/one device/i)
    expect(text).toMatch(/online/i)
  })

  it.each(Object.entries(SEO_PAGES))(
    "links %s on the canonical host with its title and description",
    (path, page) => {
      expect(text).toContain(
        `- [${page.title}](https://abalone.tudu.dev${path}): ${page.description}`,
      )
    },
  )

  it("ends with a newline", () => {
    expect(text.endsWith("\n")).toBe(true)
  })
})
