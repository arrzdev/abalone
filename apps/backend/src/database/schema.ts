import { integer, sqliteTable, text } from "drizzle-orm/sqlite-core"
import { user } from "@/database/auth.schema"

//---- profiles ----------------
//our half of a player, mirrored from better-auth's `user` by a create hook
//(auth.service.ts). the split is the rule from `stack-auth`: better-auth owns
//its own tables and we never bolt app columns onto them, so anything the app
//itself lets a player change lives here.
//
//today that is exactly one field. the username is deliberately NOT here — it is
//permanent, and the username plugin owns its uniqueness, normalisation, and the
//sign-in path, so it stays on better-auth's `user` where the plugin can see it.

export const profiles = sqliteTable("profiles", {
  userId: text("user_id")
    .primaryKey()
    .references(() => user.id, { onDelete: "cascade" }),
  //the R2 object key, null until they upload one. content-addressed, so it
  //doubles as the cache key — see profile.service.ts.
  avatarKey: text("avatar_key"),
  createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull(),
  updatedAt: integer("updated_at", { mode: "timestamp_ms" }).notNull(),
})
