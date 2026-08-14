declare namespace Cloudflare {
  interface Env extends Record<string, unknown> {
    DB: D1Database
    AVATARS: R2Bucket
    TEST_MIGRATIONS: Array<{ name: string; queries: string[] }>
    RATE_LIMIT_ALLOW_TEST_BYPASS: string
    FRONTEND_URLS: string
    BETTER_AUTH_SECRET: string
    BETTER_AUTH_URL: string
    AVATAR_PUBLIC_URL: string
  }
}
