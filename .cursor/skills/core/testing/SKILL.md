---
name: testing
description: >-
  Portable testing doctrine — placement, the test pyramid (what to test at which layer), TDD loop. Load for tests, specs, TDD, coverage, what-to-test questions.
---

# Testing

Portable doctrine — *what* to test and *how* to drive it. Concrete runner/config wiring for this repo lives in `stack/testing-setup`.

## Placement

| Test kind | Lives | Why |
|-----------|-------|-----|
| Unit / integration | **Co-located** beside source (`x.service.test.ts` next to `x.service.ts`) | Stays in the import graph; refactor/delete is atomic |
| End-to-end (full app) | top-level `e2e/` (or per-app `e2e/`) | Crosses every layer; not tied to one module |
| Shared fixtures / factories | a `test/` helper folder | Reused across many files |

Do **not** build a parallel `tests/` mirror tree for unit/integration — colocation is the default. Reserve folders for E2E and shared fixtures only. **One test file per service** (`x.service.test.ts`) — don't fragment a service's tests into `x.<concern>.service.test.ts`; if they genuinely must split, that's the signal the domain is a **module**, and its tests live inside the module folder.

Import **concrete modules**, never app-internal barrels:

```ts
import { UserService } from "@/services/user.service" // ✅
import { UserService } from "@/services"             // ❌
```

## Pyramid — what to test at which layer

| Layer | Test as | Assert | Don't |
|-------|---------|--------|-------|
| **Pure logic / utils** | Unit, no I/O | input → output, edge cases | trivial getters |
| **Service** (domain + DB) | Integration vs **real local DB** | rows written/read, domain error code thrown | mock the DB |
| **Route / handler** | Integration through the app | status, envelope shape, validation rejects | re-test service internals |
| **Facade** | Integration | orchestration + atomicity (rollback on throw) | each service again in isolation |
| **Frontend logic / hooks** | Unit (happy-dom + Testing Library) | state transitions, derived values, callbacks | rendered pixels |
| **User flow** | E2E | the path a user actually takes | exhaustive permutations |

Test **behavior and contracts**, not implementation. A test that breaks on a harmless refactor is testing the wrong thing.

## What to test (and not)

**Do:** branching logic, domain error paths, boundary/empty/overflow inputs, anything you just fixed (regression), atomic writes rolling back, validation rejecting bad input.

**Don't:** framework internals, third-party libs, trivial pass-throughs, exact private call sequences, snapshot-everything.

Cover the **failure** paths, not just the happy path — that is where bugs hide.

## TDD loop (testable work)

1. **RED** — write the test first; run it; *confirm it fails for the right reason*. A test that passes before you write the code proves nothing.
2. **GREEN** — smallest change that passes.
3. **REFACTOR** — clean up with the test as a safety net.
4. Iterate.

Backend behavior you add or fix is testable work — default to TDD. UI polish and motion usually are not.

## Agent expectations

- Add tests for behavior you introduce or fix; place them at the right layer above.
- Run the touched workspace's test command (see `stack/testing-setup`); fix failures you caused.
- Summarize pass/fail (and coverage if run) in the handoff.
