# Flaky e2e specs

A spec on this list failed on a loaded machine without a product bug. Each entry
has a cause and a state. Never skip or retry one silently; fix it or quarantine
it with an owner.

| Spec | Cause | State |
|---|---|---|
| `manual-layout.spec.ts` rail click scrolls smoothly | The glide is timed by the page clock; a stalled main thread jumped past it, so frame sampling saw 3 positions, not 4 (TUD-916, TUD-920) | Fixed (TUD-932): the test owns the clock with `page.clock` and steps 16 ms per frame |
| `manual-layout.spec.ts` nothing overflows sideways 320..2880 | Read once right after `setViewportSize`, before layout caught up (CI run 38331065877) | Fixed (TUD-932): polls the overflow until it settles |
| `text-contrast.spec.ts` phone: four pages in one test on `webkit-iphone` | The four screens shared one 60 s budget; under load the test timed out in 10 of 10 runs (TUD-923) | Fixed (TUD-932): one test per screen. The later timeout and page crash on `/` came from a CSS `drop-shadow` over the animated demo canvas (TUD-958, TUD-960) and no longer show up in the baseline below |
| `text-contrast.spec.ts` `/ text is readable` (desktop and phone variants) on `webkit-iphone` | axe reads the colors of the home cards and demo caption while they are still fading in, so text measures 3.5 to 4.1:1 instead of 4.5:1 (foreground colors differ between failures, e.g. `#cacaca` and `#b9b9b9` for the same `text-white/90`). Not a timeout | Fixed (TUD-1314): the spec scrolls every `Reveal` section into view and waits for its fade before axe runs; 20 of 20 on `webkit-iphone`, `--repeat-each=10 --workers=2` |

## Baseline (2026-10-17, 32 GB PC)

`playwright test --project=<name> --repeat-each=5 --retries=0 --workers=2`,
run in 6 shards, 298 tests per project. The suite has no plain `webkit`
project; `webkit-iphone` is the only WebKit one. Skipped runs are tests that
skip themselves on that project (touch or no touch).

| Project | Runs | Fails | Flaky specs (fails/runs) |
|---|---|---|---|
| `chromium` | 1475 | 0 | none |
| `webkit-iphone` | 860 | 3 | `text-contrast.spec.ts` `/ text is readable on a desktop` 2/5, `/ text is readable on a phone` 1/5 |

The earlier "passes under load" claim for the home contrast spec does not hold
on a quiet machine: it failed 3 of 10 runs with no extra CPU load added.

Check a fix with `--repeat-each=10 --retries=0` while another process loads the
CPU, and break the behavior the spec guards to see it fail.
