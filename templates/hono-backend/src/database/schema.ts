import { integer, sqliteTable, text } from "drizzle-orm/sqlite-core"

//---- notes ----------------
//the example domain: one table, so the template shows the whole path from
//schema to migration to service to route. replace it with the project's own.

export const notes = sqliteTable("notes", {
  id: text("id").primaryKey(),
  body: text("body").notNull(),
  createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull(),
})
