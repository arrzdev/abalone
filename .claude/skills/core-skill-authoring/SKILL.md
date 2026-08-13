---
name: core-skill-authoring
description: How to write, tier, route and validate the skills in .claude/skills — the three tiers by lifetime, the rule-vs-lookup test for what belongs in a portable skill, and the hard rule that doctrine is never deleted just because this repo hasn't adopted it yet. Use when adding, editing, renaming, tiering or routing a skill, or when deciding whether a skill is stale.
---

# Authoring skills

Doctrine for the skill system itself. Portable: the tiers, the routing model and the never-delete rule travel with the skills to the next project.

Doctrine files an agent reads **before** editing code. This file is for **maintaining** them.

## Layout

```
.claude/skills/<tier>-<topic>/SKILL.md
```

One directory per skill, holding `SKILL.md` with YAML frontmatter (`name`, `description`). **`name` must equal the directory name** or the skill is silently never discovered — the validator checks this.

Discovery only looks **one level** under `.claude/skills/`, so the tier cannot be a parent folder; it's the name prefix instead. That still gives you tier grouping in `ls`, and porting stays a one-liner:

```bash
cp -r .claude/skills/core-* .claude/skills/platform-* <new-repo>/.claude/skills/
```

## How a skill reaches an agent (three routes)

They cover different failure modes, which is why all three exist:

| Route | Matches on | Lives in | Fails when |
|---|---|---|---|
| **Frontmatter** | the request, semantically | each `SKILL.md` `description` | the match is fuzzy; ordering is not guaranteed |
| **Routing table** | trigger words, with explicit read order | `CLAUDE.md` | context is long and the model stops consulting it |
| **Path hook** | the file about to be edited | `skills/routing.json` → `.claude/hooks/route-skills.py` | the work isn't an edit (planning, review, answering) |

Frontmatter gets a skill *discovered*; the table decides *what order to read them in* when several apply; the hook guarantees the rule fires at the moment of an edit even if nothing else did. Only the hook is deterministic, so it is the backstop — not the primary.

A second hook, `Stop` → `.claude/hooks/verify-gate.py`, enforces the verify gate: if TS/TSX under `apps/` or `packages/` is dirty, it blocks the turn ending **once per session** with the scoped commands. It honours `stop_hook_active` and a session marker so it can never trap a session, and it can only tell that source changed — not that the checks passed.

The routing hook is a `PreToolUse(Edit|Write|MultiEdit)` that resolves the target path against `routing.json` and injects the governing skill list — **once per skill set per session**, so it informs without spamming. It never blocks: any failure exits 0 silently, because a hook that breaks editing is worse than one that misses a reminder.

**Write the `description` for matching, not for looks.** It is the only thing scanned when deciding whether to load the skill. Lead with what it governs, then a literal *"Use when …"* clause carrying the words someone would actually type. Generic descriptions never match.

## Validate after any change

```bash
python3 .claude/scripts/check-skills.py && python3 .claude/scripts/test-hooks.py
```

Both run in CI (`ci.yml` → `skills-guard`), PR-only by design — a broken skill degrades agent sessions, it doesn't ship.

**`check-skills.py`** — frontmatter validity (a `name` that doesn't match its directory means the skill is *never discovered*, with no error anywhere), dangling cross-references, skills missing from `CLAUDE.md`, `routing.json` entries pointing at nothing, globs matching nothing on disk, and `core-` skills that name this checkout.

**`test-hooks.py`** — drives the real hook as a subprocess over ~20 representative paths and asserts the exact skill list *and order*, plus that irrelevant files stay silent, repeats are suppressed, and non-edit tools never trigger. It does not reimplement the matching, so a hook bug fails the test instead of being mirrored by it.

Both matter because **the hook fails soft on purpose**: a mistyped glob produces silence, and silence is indistinguishable from "this file has no skills". That is not hypothetical — writing these tests immediately caught `apps/*/env/**` matching nothing, so every env file had been getting baseline skills only.

## The three tiers — sorted by what outlives what

| Tier | Contains | Test |
|---|---|---|
| **`core-*`** | style, process, architecture, repo layout, error/test patterns | survives a copy into **any** project |
| **`platform-*`** | how the target runtime behaves — iOS/WebKit/standalone PWA | survives a copy into any project on the **same target** |
| **`stack-*`** | this repo's wiring — Cloudflare/Hono/Drizzle/D1, TanStack, `@repo/nativ`, `@repo/synq`, env, deploy, the dev log sink | must be **re-derived** when porting |

The `platform-` tier exists because runtime findings are long-lived but not stack-bound. "iOS edge swipe-back can't be `preventDefault`ed" and "WebKit's focus reveal beats a warm-keyboard smooth scroll" stay true no matter what you build the next app with — they cost days to measure and would be silently lost if filed under the tier labelled *re-derive when porting*.

The split is by **lifetime, not subject.** iOS behavior → `platform-`. This repo's dev ports, worktree bootstrap, and framework layer → `stack-`. Both can be about "the mobile app".

**Most skills are portable — `core-` is the default, `stack-` is the exception.** If it would still be true with a different database and a different framework, it's `core-`. If it names a package, a path, a port, a script, or a config file, it's `stack-`.

### Folders and file names are `core-` content — don't abstract them away

**Structure skills are supposed to name folders and files.** `core-repository-layout`, `core-imports`, and `core-backend-architecture` are *about* how a repo is laid out — `apps/*`, `packages/*`, `services/`, `facades/`, `#nativ/*`, `data/collections/items/queries.ts`, `account-deletion.facade.ts`. Those concrete examples are what make the rule legible. Replacing them with `{domain}` placeholders doesn't make a skill more portable, it makes it unreadable.

The layout conventions themselves travel between projects — that's exactly why they're `core/`.

What actually doesn't belong in a `core-` skill:

| ❌ In a `core-` skill | Why | ✅ Where it goes |
|---|---|---|
| "read `apps/backend/src/http/errors.ts` before adding a code" | a lookup into *this* checkout, not a rule | `stack-api-routes` |
| "`nuqs` is not installed here; `use-persistent-state` exists" | a dependency inventory | `stack-ui-shell` |
| D1 batch semantics, synq merge rules, wrangler deploy phases | tied to one vendor/product | `stack-database`, `stack-sync-engine`, `stack-deploy-environments` |

The test is **rule vs. lookup**, not abstract vs. concrete. "Facades live in `facades/{domain}.facade.ts`" is a rule with a concrete shape — keep it. "The registry is at `apps/backend/src/http/errors.ts`" only helps someone standing in this repo — that's `stack/`.

When a portable rule genuinely needs this repo's wiring, cross-reference instead of inlining it: `core-testing` ↔ `stack-testing-setup` is the model.

`core-commit-style` is a deliberate hybrid — its rule *is* this repo's git workflow (PR base resolver, squash-only merge). Don't generalize it away.

## Repo members these skills describe

| Member | What |
|---|---|
| `apps/backend` | Hono API on Cloudflare Workers + D1 (Drizzle), better-auth, the sync server |
| `apps/frontend` | TanStack Start PWA over `@repo/nativ`, offline-first via `@repo/synq` |
| `packages/nativ` | the PWA shell framework — config-driven, generates root/router/manifest/SW |
| `packages/synq` | the offline-first sync engine — HLC + field-level LWW merge, client **and** server halves |
| `packages/shared` | `tryCatch`, `Logger`, the Hono `newEndpoint` / envelope factory |
| `packages/env-validation` | schema-first env registry + `check:env` CLI |
| `packages/dev` | dev-only infra — run-dev, ports, LAN IP, the log sink |

## These skills outlive this repo — never delete on "unused"

Skills are **carried between projects**. Several document work this repo hasn't done yet (Turnstile, URL-driven filters, facades and modules, polyglot apps). That is deliberate: when the work comes up, the skill already maps the right way to do it, so the decision doesn't get re-litigated from scratch.

**A skill describing tech the repo doesn't use is not stale.** Do not delete it, gut it, or rewrite it into whatever the repo happens to do today.

The distinction that matters:

| Situation | Action |
|---|---|
| Skill describes a pattern the repo hasn't adopted yet | **Keep the pattern.** Add a short "where this repo stands today" note |
| Skill describes the repo's own wiring, and the wiring changed | **Fix it** — this is real drift |
| Repo does X, skill prescribes Y, both are legitimate | Keep both: Y as doctrine, X as this repo's instance |

Same instinct as `stack-gotchas` → "this is a compounding template repo": unused ≠ dead.

## Writing or editing a skill

1. **Never remove doctrine to match current code.** See above. Changing "here is how to do X" into "we don't do X" destroys the reason the file exists.
2. **Verify the repo-specific claims.** Paths, script names, ports, versions, whether a dependency is installed — all checkable in seconds, and a wrong one gets followed. Verification tells you whether to *annotate* a skill, never whether to delete it.
3. **Label what isn't wired yet**, so nobody hunts for code that isn't there (`stack-turnstile` opens with it; `core-input-handling` has a "where this repo stands today" section).
4. **Prefer the trap over the tutorial.** The value is in what costs time to rediscover — measured behavior, non-obvious ordering, things that look like bugs and aren't. General framework knowledge isn't worth a line.
5. **Cross-reference by skill name** in backticks (`core-try-catch`, `stack-database`) — the validator resolves these, so a typo is caught. Don't restate another skill's rule — point at it.
6. **Match the house code style in examples.** Agents copy them verbatim: double quotes, no semicolons, `//lowercase comments with no space`, narrow lines. See `core-code-style` and `biome.json`.
7. **Register it everywhere it needs to fire.** Frontmatter `description` (discovery), a row in `CLAUDE.md` with the trigger words a human would actually type (read order — multiple rows may list the same skill and the router unions them), and a `routing.json` rule if the skill governs specific files. Then run the validator.

## Maintenance

When a skill's claim about *this repo* turns out to be wrong, fix it in the same change as the code — that's the point of it living in-repo. `.claude/` is excluded from Biome (`!!.claude` in `biome.json`), so the verify gate never touches these files; correctness is on the author.
