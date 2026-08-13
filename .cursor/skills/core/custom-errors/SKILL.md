---
name: custom-errors
description: >-
  CustomError, error code registry, API envelope success/error, global error handler, invalid_input
  from validation. Load for error codes, HTTP error responses, domain errors.
---

# Custom errors and API envelopes

## CustomError

```ts
class CustomError extends Error {
  override readonly name = "CustomError"

  constructor(
    public readonly errorCode: ErrorCode,
    cause?: Error,
  ) {
    super(errorCode, cause !== undefined ? { cause } : undefined)
  }
}
```

- First arg: predefined **`error_code`** string from the registry.
- Second arg (optional): original error — preserves cause/stack.
- **Keep it app-local**, typed directly to the app's `ErrorCode`. Don't pre-extract a generic `CustomError<Code>` into a shared package — with one consumer that buys no reuse and forces a re-typing cast to re-pin the union. Graduate it only when a second app actually needs it.

Services/facades throw `CustomError` after analysing `tryCatch` failures.

## Typed error guard

Branching on a *specific* code is stringly-typed by default. A small guard makes it compiler-checked and autocompleted:

```ts
function isError(error: unknown, code: ErrorCode): error is CustomError {
  return error instanceof CustomError && error.errorCode === code
}
```

Use it at the rare branch sites where a specific failure changes the path:

```ts
const [user, error] = await tryCatch(() => new UserService(db).getUser(id))
if (isError(error, "user_not_found")) return renderEmptyState()
if (error) throw error
```

Architecture is unchanged (throw-by-default; see `core/try-catch`) — this only adds type safety where you actually fork on a code.

## Error code registry

Central map in the API app:

```ts
type ErrorCodeEntry = readonly [message: string, status: ContentfulStatusCode]

const ERROR_CODES = {
  user_not_found: ["That user was not found.", 404],
  invalid_input: ["Invalid input. Check the data and try again.", 400],
  internal_server_error: ["An unexpected error occurred.", 500],
} as const satisfies Record<string, ErrorCodeEntry>

export type ErrorCode = keyof typeof ERROR_CODES
```

**`as const satisfies` — not a `: Record<…>` annotation.** The annotation widens `keyof` to `string`, silently disabling every error-code type-check (`new CustomError("typo")` would compile). `as const` preserves the literal keys (so `ErrorCode` is a real union) and `satisfies` validates the shape.

Bind **one envelope factory** to the codes for the app's `ok()` / `error()` (`const { ok, error } = createApiEnvelope(ERROR_CODES)`). Keep the error model (codes + `CustomError`) and the envelope (`ok`/`error`) in **leaf modules** routes and the global catcher import — **not** in the composition root that mounts the routes, or routes ↔ composition becomes a circular import.

The codes' **type** reaches the frontend through the typed RPC `interface` contract file it imports; the messages stay server-side.

## Response envelope

| Outcome | JSON |
|---------|------|
| Success | `{ status: "success", data?: T }` |
| Error | `{ status: "error", error_code: string }` |

HTTP status comes from the registry entry for that code.

## Global error handler

- Uncaught throws → one global catcher (Hono `onError`), not a `use()` middleware.
- `CustomError` → map `error_code` to envelope + status via the same `error()` builder.
- Unexpected errors → `internal_server_error`; log full trace **once** here.

**Production logging:** normally only in the global handler. Remove temporary debug logs elsewhere before finishing the task.

## Validation

Zod failures in route validation middleware → `invalid_input` before the handler runs.

## Routes do not map errors

Handlers do not call `error(c, code)` for domain failures. They do not wrap service calls in try/catch for branching.
