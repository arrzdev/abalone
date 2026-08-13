---
name: code-style
description: >-
  Formatting, naming (no abbreviations, is/has booleans, handleX/onX), functions & abstraction,
  immutability, comments, no-else control flow, concurrency, explicit-boundary TypeScript,
  current-not-deprecated APIs, Zod.
  Load for any TypeScript implementation, review, or refactor.
---

# Code style

The repo formatter config (Biome or equivalent) is the formatting source of truth — do not override indent, quotes, line width, or semicolons in prose.

## Readable over clever

- Prefer code that scans fast over terse or "smart" constructs.
- A `for` loop is fine when clearer than `.map()` / `.filter()` chains.
- Organize into visual blocks with whitespace and section banners.
- **Readability and performance usually agree** — the clear data structure is normally the fast one. They only "trade off" in the rare genuine conflict (see Concurrency / Performance below); don't pre-optimize against readability.

## Naming

- **No abbreviations.** Full words: `error` not `err`, `index` not `idx`, `button` not `btn`. Name by **role**, not type: `pendingItems`, not `arr` / `data`. **Accepted shorthands:** `c` (Hono context), loop `i`, `e` (event), `el` / conventional DOM-handle names, and tightly-scoped math/geometry/platform-API locals (`dx`, `dy`, `dt`, `vel`, `vv`, `vk`) inside one function.
- **Booleans** read as predicates: `isLoading`, `hasError`, `shouldRetry`, `canSubmit`.
- **Handlers:** `handleX` for the implementation, `onX` for the prop that receives it — `onClick={handleClick}`.
- **Functions** are verbs (`fetchUser`, `mergeRanges`); **values** are nouns.

## Functions & abstraction

- Named declarations: **`function foo()`** — not `const foo = () => {}`. Arrow functions only for inline callbacks.
- **Read options bags directly — don't destructure them.** For a config/options parameter, access `options.foo` (default inline: `options.foo ?? fallback`) instead of `const { foo = fallback } = options`. Every field stays greppable to its source and the default lives at the point of use. This applies to plain functions' options/config objects; destructuring **React component props** in the signature stays idiomatic.
- **Extract on a *name*, not on a repeat.** Pull a block into a helper when it has a clear concept-name — even used once. Do **not** extract just because logic appears twice if the copies may evolve apart: **tolerate a little duplication over the wrong abstraction.**
- **Split a file** when describing it needs "AND" (`user.service.ts` → `user-stats.service.ts`). See `core/repository-layout`.

## Immutability

- **Never mutate** arguments, props, or shared state — return new values.
- **Local mutation is fine:** a mutable accumulator inside a `for` loop is clearer than a forced `reduce`. Immutability is a boundary rule, not a religion.

## Comments

**Normal inline:** `//this style` — no space after `//`, lowercase, no trailing period.

**Section banners** (chunk longer files):

```
//---- permission ----------------
```

Blank lines before and after.

**Discipline:**

- Explain non-obvious **why**; names + structure carry the **what**.
- A banner is the right tool to chunk a long function — reach for it **before** prematurely extracting a helper/component that has no name and no reuse.
- Do not narrate every line.

## Control flow

- **Guard clauses + early returns.** Invert failures and edge cases at the top; keep the happy path flat and un-indented.
- **Avoid `else` after an early return** — it's redundant, drop it. But `if/else` for two symmetric branches and `else if` **dispatch chains** (mapping one value to several outcomes) are fine — don't force a dispatch into five early returns.
- Single-line guards when the body is one statement: `if (pending) return true`. Multi-line block when the branch does real work.

## Concurrency / performance

- **Parallelize independent I/O by default** — `Promise.all` / `db.batch` when calls don't depend on each other; sequential `await`s only when order matters or one feeds the next.
- Don't parallelize plain logic — keep non-I/O straight-line.
- **`useMemo`/`memo`/manual batching only when you're confident it helps** (or it's hot-path / `packages/` infra). In app/feature code, readability wins until there's evidence.

## TypeScript

- **Explicit at boundaries, inferred inside.** Hand-write types at module / function / component **public** edges (params, returns, props) for readable hovers and good error messages. Let inference flow for locals and internals.
- **Derive instead of duplicating** a function/component's own shape: `ReturnType`, `Awaited<ReturnType<…>>`, `Parameters<typeof fn>`, `ComponentProps<typeof X>`.
- Named types in `types.ts` only for shared **domain** concepts. Avoid `any`; a local `as` / `any` is a last resort with a `//why` — **one `//why` per cast-island** is enough for unavoidable framework/platform bridges (Hono's untyped context, native-event re-dispatch, webworker globals).
- **`as const satisfies T` for literal data that is a contract** (error-code maps, route tables): `satisfies` validates the shape, `as const` keeps the literal keys/values so `keyof`/lookups stay typed. A plain `: T` annotation widens them (`keyof` collapses to `string`) — don't annotate maps whose keys are the contract. Bare `as const` is also right for tuples that must stay literal (`[data, error] as const`, query keys). Outside those, prefer declaration-site types over trailing `as`.
- **No dead defensiveness.** `xs ?? []` / `xs?.length` on a value the types say is non-null (`Item[]`) is noise — trust the type; guard only where it can actually be `null`/`undefined`.

## Current APIs — no deprecated code

Deprecation is **invisible to the verify gate**: `tsc` and Biome do not flag `@deprecated` usage (the editor strikethrough comes from the language server, which the gate never runs). Treat it as a manual step, not a caught error.

- Writing against a library? Confirm the call is the **current** form for the **installed** version (check `package.json`) — don't pattern-match an old API from memory or training data.
- Cheapest check first: read the symbol's own `@deprecated` JSDoc straight from `node_modules`; then the library's `CHANGELOG` / migration guide. Use the replacement the tag names.
- Same instinct beyond deprecation: when unsure an API is current, verify before writing — a wrong-but-compiling call ships green.

## Zod

- Route/form validation uses Zod; schemas colocated with handler/form.
- Prefer the **top-level form** (current API — see above): `z.url()`, `z.uuid()`, `z.email()` — not the deprecated `z.string().url()` / `.uuid()`. Allow empty URL: `.or(z.literal(""))`.
