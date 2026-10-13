# Flaky e2e specs

A spec on this list failed on a loaded machine without a product bug. Each entry
has a cause and a state. Never skip or retry one silently; fix it or quarantine
it with an owner.

| Spec | Cause | State |
|---|---|---|
| `manual-layout.spec.ts` rail click scrolls smoothly | The glide is timed by the page clock; a stalled main thread jumped past it, so frame sampling saw 3 positions, not 4 (TUD-916, TUD-920) | Fixed (TUD-932): the test owns the clock with `page.clock` and steps 16 ms per frame |
| `manual-layout.spec.ts` nothing overflows sideways 320..2880 | Read once right after `setViewportSize`, before layout caught up (CI run 38331065877) | Fixed (TUD-932): polls the overflow until it settles |
| `text-contrast.spec.ts` phone: home/rules/strategy and bot game on `webkit-iphone` | `/rules` and `/offline` not hydrated after `fetch failed` from the Worker; 60 s timeout (TUD-923) | Open (TUD-932): not yet reproduced; see the PR |

Check a fix with `--repeat-each=10 --retries=0` while another process loads the
CPU, and break the behavior the spec guards to see it fail.
