import { defineConfig } from "drizzle-kit"

export default defineConfig({
  //a project that adds better-auth lists its auth.schema.ts here too: both
  //halves live in the same D1, so drizzle has to see both or `generate` would
  //emit a migration that drops every auth table (see abalone's config)
  schema: ["./src/database/schema.ts"],
  out: "./src/database/migrations",
  dialect: "sqlite",
  casing: "snake_case",
  verbose: true,
  strict: true,
})
