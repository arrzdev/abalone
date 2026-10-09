import tryCatch from "@repo/shared/try-catch"
import { sql } from "drizzle-orm"
import type { Db } from "@/database/client"
import { CustomError } from "@/http/errors"

export class HealthService {
  constructor(private db: Db) {}

  /**
   * Proves the database answers, by asking it the cheapest question there is.
   *
   * Touches no table on purpose: a probe that read real rows would report the
   * database as down whenever one table had a problem the rest of the app does
   * not share.
   */
  async checkDatabase(): Promise<void> {
    const [, queryError] = await tryCatch(() => this.db.run(sql`select 1`))
    if (queryError)
      throw new CustomError("service_unavailable", queryError)
  }
}
