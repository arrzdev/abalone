---
name: imports
description: >-
  App self-alias (@/*), package self-alias (#<slug>/*), workspace imports (@repo/*),
  tsconfig and package.json exports. Load when adding imports, splitting code
  across members, wiring typed RPC clients, or fixing TS2307.
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

**Generated files** (e.g. `routeTree.gen.ts`) are excluded from lint.

---

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
import { buildPlugin } from "@repo/<ui-slug>/vite"
import { createRootRoute } from "@repo/<ui-slug>/shell"
import type { RoutesInterface } from "@repo/<api-slug>/http"

// ❌ Never in an app
import { Button } from "#/components/button"
import { x } from "#<other-app>/..."
```

App source lives under `src/` (including `src/scripts/`, `src/ports.ts`). App env lives under `env/` (`schema.ts`, `registry.ts`, `.env*`) — import via `@/env/*` (e.g. `@/env/registry`, `@/env/schema`). List `@/env/*` before `@/*` in `imports` / `paths`.

**Forbidden in app `tsconfig` paths / `package.json` imports:** any `#/*` entry, or any path pointing at another member's `src/` tree. That leaks a package-internal alias into the app and bypasses `exports`. Biome blocks `#/*` imports in apps.

---

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

**Export entry barrels** (`src/index.ts`, `src/components/index.ts`, …) use **relative** re-exports (`export * from "./button"`). Package implementation files use `#<package-slug>/…`. Biome disables `noRestrictedImports` only on those barrel paths.

**Apps typecheck workspace packages without path hacks:** each package with `#<slug>/` internals exposes `types` + `default` in `package.json` `exports`, ships declarations via a package `tsconfig.build.json`, and is listed in the root `tsconfig.json` `references`. Apps add a `references` entry to that build config when they depend on the package. Run the repo's project-reference build (`tsc --build` or equivalent) before app `noEmit` so consumers resolve `.d.ts`, not package source.

```jsonc
// packages/<pkg>/package.json — pattern
"exports": {
  "./components": {
    "types": "./.tsbuild/components/index.d.ts",
    "default": "./src/components/index.ts"
  },
  "./config": {
    "types": "./.tsbuild/config/index.d.ts",
    "default": "./src/config/index.ts"
  },
  "./vite": {
    "types": "./.tsbuild/vite/index.d.ts",
    "default": "./src/vite/index.ts"
  },
  "./client": {
    "types": "./.tsbuild/client/index.d.ts",
    "default": "./src/client/index.ts"
  }
}
```

**Node-loaded entrypoints** (`./config`, `./vite`, `./client` export subpaths) use the **`#<package-slug>/*` alias too** — because it is Node-valid (unlike `#/*`), it resolves under `vite.config.ts` and other Node-run files with no relative-import fallback. (If you ever see `../` creeping into these, it means the package is still on `#/*`.)

---

## Cross-runnable rule

No runtime imports from one app's implementation into another. **Exception:** `import type` from the API package's HTTP/RPC export (e.g. `@repo/<api-slug>/http`) for a typed Hono client only.

---

## Enforcement

- Biome (`noRestrictedImports`): blocks `./*` and `../*` everywhere, and `#/*` inside apps. **Gap:** it does **not** block `#/*` inside `packages/*` — add a package-scoped rule so the footgun can't reappear.

---

## Checklist

1. Same app? → `@/…`
2. Same package? → `#<slug>/…`
3. Another workspace member? → `@repo/…/<export-subpath>`
4. Export missing? → add to that member's `package.json` `exports`
