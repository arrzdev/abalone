import tryCatch from "@repo/shared/try-catch"
import { sql } from "drizzle-orm"
import type { Db } from "@/database/client"

//how long one resource may take to answer before it counts as down. short on
//purpose: a monitor waits for the slowest check, and a resource this slow is
//not one the game can serve a player from either
const CHECK_TIMEOUT_MS = 1_500

//what a probe may learn about a resource. a state, never the error behind it:
//the report is public, and a driver message can name hosts, ids or versions
export type ResourceState = "ok" | "down"

/** One entry per resource this worker depends on, by kind. */
export type HealthReport = {
  database: ResourceState
  r2: ResourceState
}

export class HealthService {
  constructor(
    private db: Db,
    private avatars: R2Bucket,
  ) {}

  /**
   * Asks every resource the cheapest question it answers, all at once.
   *
   * Touches no real row or object on purpose: a probe that read app data would
   * report a resource as down whenever one table or key had a problem the rest
   * of the app does not share.
   */
  async check(): Promise<HealthReport> {
    const [database, r2] = await Promise.all([
      this.probe(() => this.db.run(sql`select 1`)),
      //a missing key answers null, which is an answer: only a throw or a
      //timeout means the bucket cannot be reached
      this.probe(() => this.avatars.head("health-probe")),
    ])
    return { database, r2 }
  }

  private async probe(
    question: () => Promise<unknown>,
  ): Promise<ResourceState> {
    let timer: ReturnType<typeof setTimeout> | undefined
    const timeout = new Promise<never>((_, reject) => {
      timer = setTimeout(
        () => reject(new Error("health check timed out")),
        CHECK_TIMEOUT_MS,
      )
    })
    const [, failure] = await tryCatch(() =>
      Promise.race([question(), timeout]),
    )
    clearTimeout(timer)
    return failure ? "down" : "ok"
  }
}
