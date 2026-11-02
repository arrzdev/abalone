import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

const SAFARI_18 =
  "Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1"
const SAFARI_17 = SAFARI_18.replace("Version/18.0", "Version/17.4")
const CHROME =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0 Safari/537.36"

//the polyfill installs once per page, so each test loads a fresh copy of the
//module against its own navigator
async function install(navigator: Partial<Navigator>) {
  vi.stubGlobal("navigator", navigator)
  vi.resetModules()
  const { installVibratePolyfill } = await import(
    "#nativ/utils/install-vibrate-polyfill"
  )
  installVibratePolyfill()
  return navigator as Navigator
}

function switchLabel() {
  return document.head.querySelector("label")
}

beforeEach(() => {
  document.head.innerHTML = ""
})

afterEach(() => {
  vi.unstubAllGlobals()
})

describe("installVibratePolyfill with native vibrate", () => {
  it("cancels the running pattern before each new one", async () => {
    const nativeVibrate = vi.fn(() => true)
    const navigator = await install({
      userAgent: CHROME,
      vibrate: nativeVibrate,
    })

    expect(navigator.vibrate([10, 20, 10])).toBe(true)

    expect(nativeVibrate.mock.calls).toEqual([[0], [[10, 20, 10]]])
  })

  it("only cancels for a zero or empty pattern", async () => {
    const nativeVibrate = vi.fn(() => true)
    const navigator = await install({
      userAgent: CHROME,
      vibrate: nativeVibrate,
    })

    expect(navigator.vibrate(0)).toBe(true)
    expect(navigator.vibrate([])).toBe(true)

    expect(nativeVibrate.mock.calls).toEqual([[0], [0]])
  })

  it("accepts any iterable pattern", async () => {
    const nativeVibrate = vi.fn(() => true)
    const navigator = await install({
      userAgent: CHROME,
      vibrate: nativeVibrate,
    })

    navigator.vibrate(new Set([30, 10]) as unknown as number[])

    expect(nativeVibrate).toHaveBeenLastCalledWith([30, 10])
  })

  it("installs once even if called again", async () => {
    const nativeVibrate = vi.fn(() => true)
    const navigator = await install({
      userAgent: CHROME,
      vibrate: nativeVibrate,
    })
    const { installVibratePolyfill } = await import(
      "#nativ/utils/install-vibrate-polyfill"
    )
    const wrapped = navigator.vibrate

    installVibratePolyfill()

    expect(navigator.vibrate).toBe(wrapped)
  })
})

describe("installVibratePolyfill on Safari without vibrate", () => {
  it("clicks a hidden switch for a pulse on Safari 18", async () => {
    const navigator = await install({ userAgent: SAFARI_18 })
    const label = switchLabel()
    const click = vi.spyOn(label as HTMLLabelElement, "click")

    expect(label?.querySelector("input")?.hasAttribute("switch")).toBe(
      true,
    )
    expect(label?.style.display).toBe("none")
    expect(navigator.vibrate(15)).toBe(true)
    expect(click).toHaveBeenCalledOnce()
  })

  it("does not click for a pattern that starts with no pulse", async () => {
    const navigator = await install({ userAgent: SAFARI_18 })
    const click = vi.spyOn(switchLabel() as HTMLLabelElement, "click")

    expect(navigator.vibrate([0, 50])).toBe(false)
    expect(click).not.toHaveBeenCalled()
  })

  it("leaves Safari 17 and other browsers untouched", async () => {
    const safari17 = await install({ userAgent: SAFARI_17 })
    expect(safari17.vibrate).toBeUndefined()

    const chromeWithoutVibrate = await install({ userAgent: CHROME })
    expect(chromeWithoutVibrate.vibrate).toBeUndefined()

    expect(switchLabel()).toBeNull()
  })
})
