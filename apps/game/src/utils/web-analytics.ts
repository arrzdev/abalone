const BEACON_SRC = "https://static.cloudflareinsights.com/beacon.min.js"

/** The browser, as far as the beacon needs it. */
export type AnalyticsNavigator = Pick<Navigator, "webdriver">

/**
 * Loads the Cloudflare Web Analytics beacon: page views and visitors, no
 * cookies and no storage. Does nothing without a token (dev, e2e and ci
 * builds) or when a test drives the browser.
 */
export function startWebAnalytics(
  token: string | undefined,
  document: Document,
  navigator: AnalyticsNavigator,
): void {
  const siteToken = token?.trim()
  if (!siteToken) return
  if (navigator.webdriver) return
  if (document.querySelector(`script[src="${BEACON_SRC}"]`)) return

  const beacon = document.createElement("script")
  beacon.defer = true
  beacon.src = BEACON_SRC
  beacon.setAttribute(
    "data-cf-beacon",
    JSON.stringify({ token: siteToken }),
  )
  document.head.appendChild(beacon)
}
