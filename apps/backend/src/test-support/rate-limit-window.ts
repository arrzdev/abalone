//miniflare's rate-limit bindings count in fixed windows aligned to the wall
//clock (`floor(now / period)`), and every count resets at the edge. a test
//that sends N requests and expects the N+1th refused fails when the edge falls
//between them. call this first: it waits for the next window unless at least
//`neededMs` are left in the current one.
export async function inOneRateLimitWindow(
  periodSeconds: number,
  neededMs: number,
): Promise<void> {
  const periodMs = periodSeconds * 1000
  const leftMs = periodMs - (Date.now() % periodMs)
  if (leftMs >= neededMs) return
  await new Promise((resolve) => setTimeout(resolve, leftMs + 50))
}
