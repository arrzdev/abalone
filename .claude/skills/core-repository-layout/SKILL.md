---
name: core-repository-layout
description: How the repo is organised: apps vs packages, layer-based folders, {domain}.{role} file naming, the services to modules to packages ladder, shared kernel, and the no-barrels rule. Use when creating a file, deciding where code belongs, or naming something.
---

# Repository layout

## Top level

| Bucket | Role |
|--------|------|
| **`apps/*`** | Runnable deployables (API, frontend, workers) |
| **`packages/*`** | Shared libraries consumed via workspace exports |

Apps consume packages via workspace exports. Do not edit a shared package unless the human scoped it in the thread.

## Organization — group by what a file IS (layer-based)

Top-level layers (`routes/`, `services/`, `facades/`, `modules/`, `middlewares/`, `data/`, `components/`). This scales **because services stay single-domain and decoupled** — a service holds one domain's logic that many routes/facades reuse. Group by *kind*, decouple by *domain*; don't co-mingle a feature's layers into a feature folder. `services/` stays **flat single-file services**; a domain that outgrows one file becomes a folder in `modules/` (ladder below).

## File naming — `{domain}.{role}.ts`

One dotted **role** suffix; the domain is a single **kebab-case** token — never a second dot.

| Role | Pattern | Example |
|------|---------|---------|
| Routes | `{domain}.routes.ts` | `user.routes.ts` |
| Service | `{domain}.service.ts` | `user.service.ts` |
| Consumer | `{domain}.consumer.ts` | `jobs.consumer.ts` |
| Types | `{domain}.types.ts` | `user.types.ts` |
| Facade | `{domain}.facade.ts` | `user-profile.facade.ts` |
| Test | `{domain}.{role}.test.ts` | `user.service.test.ts` |

**Multi-word or sub-scoped domain → hyphens, not a second dot.** `user-billing.routes.ts`, `jobs-stalled-sweep.service.ts` — **not** `user.billing.routes.ts`. The dot separates domain from role; hyphens join words *within* the domain. This keeps `.service` / `.routes` / `.consumer` as clean, greppable role markers and pairs every test 1:1 with its source (`x.service.ts` ↔ `x.service.test.ts`).

**When a domain gets its own folder, drop the domain from the filename.** The folder already carries it, so a second mention stutters:

```
data/delete-account.mutations.ts                // loose in the layer → {domain}.{role}
data/collections/items/items.collection.ts   // the folder's namesake entry keeps the domain
data/collections/items/queries.ts            // inside the folder → bare role
data/collections/items/mutations.ts
data/collections/items/schema.ts
```

Same rule backend-side: a `modules/<domain>/` folder holds `index.ts` + bare-role files, not `<domain>.*` repeated per file.

**Sub-folder by domain inside a layer (`data/<domain>/…`) only when a domain grows several files** — a lone `items.schema.ts` stays flat in the layer until it has company.

**Routing files carry the role too** — `{name}.{role}.tsx`, so a filename says what it is and search stays domain-first:

```
routing/pages/items.page.tsx        // a page (route target)
routing/pages/settings.page.tsx
routing/layouts/platform.layout.tsx // a nested/pathless layout
```

The virtual route config (`routing/config.ts`) maps route paths to these files explicitly, so filenames are free-form — name them by domain + role, not by URL. The root route itself is framework-owned (nativ's generated `layouts/__root.gen.tsx`, or `layouts/_root.tsx` when ejected).

## Services → modules → packages (one mechanical ladder)

`services/` holds **one domain per file** and **only single-file services** (+ their colocated test). A folder never appears in `services/`. Promotion is by an **objective trigger** — you never classify "is this a service or a module":

| Shape | Lives in | Trigger |
|-------|----------|---------|
| `{domain}.service.ts` | `services/` | one source file |
| `{domain}/` — self-contained module (public entrypoint + machinery + types + tests) | `modules/{domain}/` | needs a **2nd source file of its own** |
| binding-injected class (a reusable "block") | `packages/{name}` | a **2nd app** imports it (or a deliberate block investment) |

A **module is just a service too big for one file**: same role — a domain's callable surface (`new Engine(env.X)`) — but its impl spans files, so it gets a folder with a public entrypoint (`modules/engine/index.ts`). Routes/facades call a service and a module identically. Complexity *inside one file* is still a service; you only promote when you would **split into files** — the same moment a helper grows substantial enough to want its own file + test.

**Service rules:**

- **Class** per domain; dependencies constructor-injected and resource-agnostic (`constructor(private db: Db)`). DB queries colocated in methods — **no** separate `queries.ts`. Trivial helpers are **private methods** (a helper wanting its own file is the promote-to-module signal).
- **A service never imports another service** — not its class, not its internals. Need another domain's *behavior*? that orchestration moves **up** to a facade. Need another domain's *data* (a type, constant, or pure function)? it's **shared kernel** wearing a service costume — hoist it (below).

## Shared kernel (hoist up, import down)

Anything ≥2 domains need lives **above/beside** the services and is imported *down*, never sideways between services:

- pure functions → `utils/` (`utils/money.ts`, `utils/crypto.ts`)
- shared types/contracts → `types/`, or the owning **module's** public entrypoint

A pure function or constant living in a `*.service.ts` but imported by *other* services is the tell it belongs in the kernel.

## Facades

Orchestration across **2+ services** lives in `facades/{domain}.facade.ts` — **never** inside a `*.service.ts`. A facade is constructed with the services it composes (`new XFacade(new A(db), new B(db))`) and owns any cross-service transaction. See `core-backend-architecture` for the trigger (any multi-service orchestration), how to extract one, and the wholesale-vs-extracted shapes.

## Services graduate into packages (the app-factory)

The end goal: a service you re-implement across projects (auth, inference, pub/sub) **moves into `packages/`** as a binding-injected class so a new app wires it in one line:

```ts
const auth = new Auth(env.D1_DATABASE)
return auth.login(input) // in an http route
```

Write services **package-ready from day one**: no hidden coupling to one app, dependencies (DB, KV, queues) received at construction, public surface = methods. That turns the repo from "an app" into an app-factory.

## Dependencies — own your interface

Build on mature libraries, but **always behind your own thin abstraction** (`Auth` over better-auth, an inference layer over a provider SDK) so app code couples to *your* surface, not the vendor's. That abstraction is exactly what becomes a portable building-block package. Don't scatter a raw dependency across the app — wrap it once.

## No app barrels (three cases)

```ts
import { UserService } from "@/services/user.service" // ✅
import { UserService } from "@/services" // ❌ re-export barrel
```

Not every `index.ts` is a forbidden barrel — distinguish:

| `index.ts` kind | Verdict |
|---|---|
| **Re-export barrel** (`export { X } from "./x"`) imported as `@/services` | ❌ forbidden — import the concrete file |
| **Composition root** (`v1Routes = newEndpoint().route("/items", itemsRoutes)`) | ✅ fine — it *composes*, it isn't an import shortcut |
| **App design-system surface** (`components/ui/index.ts`) | ⚠️ allowed as the app's UI-kit entry **if** used consistently — pick the barrel *or* deep imports, not both |

Package **public exports** may use entry barrels — that is the published API surface, not app-internal barrels. **Never** reach past a package's public exports into its internals (private files, `data-*`, internal hooks) — expand the package's interface instead, even when the package is your own (see `core-react-components`).

## Documentation

- **Default:** code + types are the docs; minimal prose.
- **Each `packages/*` gets a short README** — why it exists, what it exports (components / hooks / methods / scripts), when to use it. Matters most for reusable building-blocks.
- **Decision notes sparingly** — a short note for a big architectural call (e.g. the error model), not narration. Over-commenting makes a codebase unreadable.

## Tests

Co-locate, **one test file per service**: `user.service.test.ts` beside `user.service.ts` — do **not** fragment into `user.<concern>.service.test.ts` files (that split is the signal the domain is really a **module**, whose tests then live inside its folder). Import concrete modules, never barrels. See `core-testing`.
