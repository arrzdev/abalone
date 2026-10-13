# Flaky e2e specs

A spec on this list failed on a loaded machine without a product bug. Each entry
has a cause and a state. Never skip or retry one silently; fix it or quarantine
it with an owner.

| Spec | Cause | State |
|---|---|---|
| `manual-layout.spec.ts` rail click scrolls smoothly | The glide is timed by the page clock; a stalled main thread jumped past it, so frame sampling saw 3 positions, not 4 (TUD-916, TUD-920) | Fixed (TUD-932): the test owns the clock with `page.clock` and steps 16 ms per frame |
| `manual-layout.spec.ts` nothing overflows sideways 320..2880 | Read once right after `setViewportSize`, before layout caught up (CI run 38331065877) | Fixed (TUD-932): polls the overflow until it settles |
| `text-contrast.spec.ts` phone: four pages in one test on `webkit-iphone` | The four screens shared one 60 s budget; under load the test timed out in 10 of 10 runs (TUD-923) | Fixed (TUD-932): one test per screen. `/` on webkit-iphone still times out or crashes the page in 6 of 15 runs under load; product cause: a CSS `drop-shadow` over the animated demo canvas (TUD-958); fix in TUD-960, re-check after it merges |

Check a fix with `--repeat-each=10 --retries=0` while another process loads the
CPU, and break the behavior the spec guards to see it fail.
