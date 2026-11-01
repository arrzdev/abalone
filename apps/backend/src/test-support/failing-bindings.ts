/**
 * A D1 binding that refuses every query, the way D1 does when it is down.
 *
 * Local D1 never fails on its own, so this is the only way to reach the
 * branches that translate a database failure into an error code. Every method
 * drizzle reaches for throws, whichever one it picks.
 */
export function failingD1(): D1Database {
  const fail = () => {
    throw new Error("D1 is not answering")
  }

  //why: D1Database is a runtime class with no public constructor, so a
  //stand-in has to be asserted into the shape rather than built as one
  return {
    prepare: fail,
    batch: fail,
    exec: fail,
    dump: fail,
    withSession: fail,
  } as unknown as D1Database
}

/** An R2 binding whose every call rejects, the way R2 does when it is down. */
export function failingBucket(): R2Bucket {
  const fail = async () => {
    throw new Error("R2 is not answering")
  }

  //why: same as above, R2Bucket cannot be constructed outside the runtime
  return {
    get: fail,
    put: fail,
    head: fail,
    delete: fail,
    list: fail,
  } as unknown as R2Bucket
}
