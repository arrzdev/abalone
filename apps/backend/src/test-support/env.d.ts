declare namespace Cloudflare {
  interface Env extends Record<string, unknown> {
    DB: D1Database
    AVATARS: R2Bucket
    //inline import so this file stays a global declaration rather than becoming
    //a module, which a top-level import would make it
    PUBSUB: DurableObjectNamespace<
      import("@/modules/realtime/pubsub.do").PubSub
    >
    TEST_MIGRATIONS: Array<{ name: string; queries: string[] }>
    RATE_LIMIT_ALLOW_TEST_BYPASS: string
    FRONTEND_URLS: string
    BETTER_AUTH_SECRET: string
    BETTER_AUTH_URL: string
    AVATAR_PUBLIC_URL: string
  }
}
