/** An ExecutionContext plus a way to wait for what a route sent to the back. */
export type TestExecutionContext = ExecutionContext & {
  /** Resolves once every `waitUntil` promise so far has settled. */
  settled: () => Promise<void>
}

/**
 * An ExecutionContext the routes can actually call.
 *
 * `{} as ExecutionContext` typechecked and then threw the moment a handler
 * reached for `waitUntil`, which routes now do to publish realtime beacons
 * without making the caller wait for them.
 *
 * It keeps the promises rather than dropping them, so a test can await the
 * background work a request started instead of racing it.
 */
export function newExecutionContext(): TestExecutionContext {
  const pending: Promise<unknown>[] = []

  //why: ExecutionContext is a runtime class with no public constructor, so a
  //stand-in has to be asserted into the shape rather than built as one
  return {
    waitUntil(promise: Promise<unknown>) {
      pending.push(promise)
    },
    passThroughOnException() {},
    settled: async () => {
      await Promise.all(pending)
    },
  } as unknown as TestExecutionContext
}
