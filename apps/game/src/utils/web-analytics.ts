/** The browser, as far as the beacon needs it. */
export type AnalyticsNavigator = Pick<Navigator, "webdriver">

/**
 * Loads the Cloudflare Web Analytics beacon: page views and visitors, no
 * cookies and no storage. Does nothing without a token (dev, e2e and ci
 * builds) or when a test drives the browser.
 *
 * Contract only: the tests in `web-analytics.test.ts` say what it does.
 */
export function startWebAnalytics(
  _token: string | undefined,
  _document: Document,
  _navigator: AnalyticsNavigator,
): void {
  //not wired yet
}
