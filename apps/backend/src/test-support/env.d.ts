declare namespace Cloudflare {
  interface Env extends Record<string, unknown> {
    DB: D1Database
    TEST_MIGRATIONS: Array<{ name: string; queries: string[] }>
    RATE_LIMIT_ALLOW_TEST_BYPASS: string
    FRONTEND_URL: string
  }
}
