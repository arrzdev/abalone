---
name: core-polyglot-monorepo
description: How a non-JavaScript app (Swift, Python, Go) coexists in a pnpm/Turborepo monorepo, and the three real costs. Use when asked whether the monorepo can host another language, or when adding a non-JS app.
---

# Polyglot monorepo (extending beyond JS/TS)

When the human asks whether a **non-JS app** (Swift/iOS, Python scraper, Go service, …) can live in this monorepo alongside the existing apps.

## The boundary

`pnpm` + Turborepo are a **JavaScript/TypeScript island**. They install, link, cache, and build TS workspace members — and *only* those. A non-JS app can sit physically under `apps/` in the same git repo, but it is **not** a workspace member: pnpm won't install it and Turbo won't natively build or cache it.

**Why coexistence is free:** pnpm only treats a folder as a workspace member if it contains a `package.json`. An `apps/*` glob still *matches* `apps/ios/`, but with no `package.json` there pnpm silently skips it — a Swift/Xcode project or a Python scraper sits next to the Node apps with zero interference.

**This is fine.** A monorepo is "one repo, many deployables," not "one toolchain." Co-locating buys shared git history, atomic cross-stack commits, and one home for contracts — without forcing every app through the same build.

## APIs are language-agnostic

The backend serves HTTP/JSON. **It does not care who consumes it** — a React app, a Swift app, and a Python job are all just clients. Putting a Swift app shoulder-to-shoulder with the backend is normal and correct; proximity creates no coupling.

## The three real costs

| Cost | What it means |
|------|---------------|
| **Tooling cohesion** | `pnpm dev` won't boot Xcode or a Python venv. Each non-JS app keeps its own run/build command (xcodebuild/Tuist/Fastlane, uv/poetry, …). |
| **CI runners** | Swift needs **macOS runners** (pricier/slower); Python needs its own setup step. Add a separate CI job per language — don't bend the JS job. |
| **Shared types** | No shared workspace *package* across languages. Share the **contract**, not code: generate types from the source of truth (Zod schema → JSON Schema/OpenAPI → Swift/Python via codegen). |

## How to attach a non-JS app

1. Put it under `apps/<name>/` as a sibling. With an `apps/*` workspace glob it's **auto-ignored** (no `package.json` = not a member) — only add an explicit `- "!apps/<name>"` exclusion **if** you later drop a `package.json` there for JS tooling.
2. Drive its build with its **native tool**. Optionally wrap that in a Turbo task (`apps/<name>#build` shelling out) for one-command ergonomics — but Turbo's cache can't understand its artifacts, so leave it uncached.
3. Add a **language-specific CI job**, gated on a path filter so JS PRs don't pay for it.
4. For request/response types, **codegen from the backend contract** — never hand-duplicate shapes.

## Agent stance

When asked to add a non-JS app: confirm this boundary out loud, scaffold it as a sibling, and **do not** try to make pnpm/Turbo manage it as a workspace member. Treat contract-sharing as codegen, not a shared package. For the shared dev log stream that any language can post to, see `stack-debugging`.
