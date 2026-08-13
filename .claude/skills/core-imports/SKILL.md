---
name: core-imports
description: Import aliases and member boundaries: @/ inside an app, #<slug>/ inside a package, @repo/<slug>/ across members, never relative paths, and why bare #/ is invalid Node ESM. Use when adding an import, wiring package exports, or fixing an import lint error.
---

# Imports and boundaries

## Mental model

| Scope | Syntax | Maps to |
|-------|--------|---------|
| Inside an **app** | `@/…` | `./src/…` |
| Inside a **package** | `#<slug>/…` | that package's files (Node-valid; **not** `#/…`) |
| Across members | `@repo/<slug>/…` | That member's `exports` only |

Never use `./` or `../` in hand-written TypeScript/TSX (Biome). Never use another member's `@/` or `#/` alias. Never deep-import past `exports` (e.g. `@repo/<pkg>/src/...`).

**The alias is the signal:** `@/` / `#<slug>/` mean *private to this member*; `@repo/<name>/…` means *crossing into another member's public surface*. Keep them distinct — **never self-reference a member by its own `@repo/<name>`**: Node routes that through `exports`, so it would force you to make internals public, and it erases the private/public signal. Self-reference is **always** the alias.

**Generated files** are excluded from lint entirely (`routeTree.gen.ts`, `__root.gen.tsx`, `router.gen.tsx`, `database/migrations`) — don't chase import style in them.

## Apps (`apps/*`)

**`package.json`**

```jsonc
{
  "name": "@repo/<app-slug>",
  "imports": {
    "@/env/*": "./env/*",
    "@/*": "./src/*"
  },
  "dependencies": { "@repo/<ui-slug>": "workspace:*" }
}
```

**`tsconfig.json`**

```jsonc
{
  "compilerOptions": {
    "baseUrl": ".",
    "paths": {
      "@/env/*": ["./env/*"],
      "@/*": ["./src/*"]
    }
  }
}
```

```ts
// ✅ Inside an app
import { AppLayout } from "@/components/app-layout"
import { api } from "@/data/backend-client"

// ✅ Cross-package (subpaths from that member's exports)
import { Button } from "@repo/<ui-slug>/components"
import type { RoutesInterface } from "@repo/<api-slug>/http"

// ❌ Never in an app
import { Button } from "#/components/button"
```

App source lives under `src/`. App env lives under `env/` — import via `@/env/*`. List `@/env/*` before `@/*` in `imports` / `paths`.

**Forbidden in app `tsconfig` paths / `package.json` imports:** any `#/*` entry, or any path pointing at another member's `src/` tree.

## Packages (`packages/*`)

A package's internal alias is **always `#<package-slug>/*`** (`#nativ/*`, `#shared/*`, `#dev/*`). A Node `imports` key must be `#` + a **name** + `/` — the part after `#` is that name. **Bare `#/*` is INVALID in Node ESM** (`ERR_INVALID_MODULE_SPECIFIER: "#/foo" is not a valid internal imports specifier name`): its name is empty. It only "works" when **bundled** — Vite/`tsc` resolve `#/` themselves and never ask Node — so the instant a file runs under raw **Node/tsx** (vitest, CLIs, dev launchers, vite-plugin files) Node rejects it. **`#/*` is therefore forbidden, even for bundler-only packages** — it's a footgun the moment any file runs outside the bundler (symptom: a vitest `#` alias hack or relative-import fallbacks creeping into `vite/` files).

**`package.json`**

```jsonc
{
  "name": "@repo/<package-slug>",
  "imports": { "#<package-slug>/*": "./*" },
  "exports": {
    "./components": "./src/components/index.ts"
  }
}
```

**`tsconfig.json`**

```jsonc
{
  "compilerOptions": {
    "baseUrl": ".",
    "paths": { "#<package-slug>/*": ["./*"] }
  }
}
```

```ts
// ✅ Inside a package (Node-valid prefix)
import { parseEnvFile } from "#env-validation/src/parser"

// ✅ Package → package
import tryCatch from "@repo/<shared-slug>/try-catch"

// ❌ Invalid in Node ESM — throws ERR_INVALID_MODULE_SPECIFIER under tsx
import { parseEnvFile } from "#/parser"
```

**Export entry barrels** use **relative** re-exports (`export * from "./button"`). Package implementation files use `#<package-slug>/…`.

Apps typecheck workspace packages without path hacks: each package with `#<slug>/` internals exposes `types` + `default` in `package.json` `exports`, ships declarations via a package `tsconfig.build.json`, and is listed in the root `tsconfig.json` `references`.

## Cross-runnable rule

No runtime imports from one app's implementation into another. **Exception:** `import type` from the API package's HTTP/RPC export for a typed Hono client only.

## Enforcement

Biome's `noRestrictedImports` carries the whole rule, in four layers. Read the config before "fixing" a lint error by adding an override:

| Scope | Blocks |
|---|---|
| Base | `./*`, `../*` everywhere |
| `apps/**/*.{ts,tsx}` | `./*`, `../*`, **and `#/*`** — apps use `@repo/<slug>/…` exports only |
| `packages/**/*.{ts,tsx}` | `./*`, `../*`, **and `#/*`** — invalid Node ESM; use `#<slug>/*` |
| **Off** for entry barrels (`**/index.ts`, `src/interface/*.index.ts`) and build-time files (`vite.config.ts`, `entrypoint/**`, `packages/**/src/{config,vite,client}/**`) | relative re-exports are correct there |

**Both `#/*` footguns must be blocked, apps *and* packages** — a rule that only covers apps leaves the Node-ESM footgun free to reappear in a package. Outside the two off-lists, a surviving `./` or `../` is a real violation, not a missing rule.

## Checklist

1. Same app? → `@/…`
2. Same package? → `#<slug>/…`
3. Another workspace member? → `@repo/…/<export-subpath>`
4. Export missing? → add to that member's `package.json` `exports`
