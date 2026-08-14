import { drizzle } from "drizzle-orm/d1"
import * as authSchema from "@/database/auth.schema"
import * as appSchema from "@/database/schema"

//both halves in one client: better-auth's drizzle adapter resolves its tables
//through this handle, so its schema has to be registered alongside ours even
//though the two files stay separate (see auth.schema.ts).
const schema = { ...appSchema, ...authSchema }

export type Db = ReturnType<typeof createDb>

const cache = new Map<D1Database, Db>()

//cache the drizzle client per binding: a D1 binding is stable within an isolate,
//so build the client once and reuse it across requests. multi-binding ready.
export function getDb(binding: D1Database): Db {
  const cached = cache.get(binding)
  if (cached) return cached
  const db = createDb(binding)
  cache.set(binding, db)
  return db
}

function createDb(binding: D1Database) {
  return drizzle(binding, { schema })
}
