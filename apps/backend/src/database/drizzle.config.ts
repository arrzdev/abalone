import { defineConfig } from "drizzle-kit"

export default defineConfig({
  //both halves: better-auth owns its tables in their own file, but they live in
  //the same D1 and are migrated by the same pipeline, so drizzle has to see both
  //or `generate` would emit a migration that drops every auth table.
  schema: ["./src/database/schema.ts", "./src/database/auth.schema.ts"],
  out: "./src/database/migrations",
  dialect: "sqlite",
  casing: "snake_case",
  verbose: true,
  strict: true,
})
