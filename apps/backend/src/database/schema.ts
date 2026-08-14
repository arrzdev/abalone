import { integer, sqliteTable, text } from "drizzle-orm/sqlite-core"

//---- items ----------------
//the example table, here to keep the database layer wired end to end: drizzle
//schema -> `db:generate` -> a migration in migrations/ -> applied by the deploy
//and by `migrate:local`. no route reads it yet — replace it with a real domain,
//or delete this file and `database/` outright if the api stays stateless.

export const items = sqliteTable("items", {
  id: text("id").primaryKey(),
  title: text("title").notNull(),
  createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull(),
  updatedAt: integer("updated_at", { mode: "timestamp_ms" }).notNull(),
})
