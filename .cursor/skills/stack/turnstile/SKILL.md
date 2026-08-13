---
name: turnstile
description: >-
  Cloudflare Turnstile (silent captcha) — the interaction-only state machine,
  single-use tokens, the "disabled button always has a visible cause" UX rule,
  test keys for every branch, fail-closed server verify, and the site/secret
  key pairing invariant. Load before touching the login widget, token
  verification, or the captcha env.
---

# Cloudflare Turnstile (silent captcha)

How Turnstile actually behaves, the edge cases that bite, and the gold-standard way to wire it so a user is **never** blocked without a visible reason. Read before touching the login widget, the token verification, or the captcha env.

Aspirational — Turnstile is **not yet wired** in this repo. This is the target pattern to follow when you add it: the client widget + `useTurnstile` hook belong under `apps/frontend/src/` (e.g. `components/turnstile.tsx`) with the UX in the frontend's login page, and the server verify (`verifyTurnstile`) belongs under `apps/backend/src/` (a service that calls Cloudflare `siteverify`, gated on a route/middleware).

## What Turnstile is

A bot check that issues a short-lived **token** the browser attaches to a request; your server verifies that token against Cloudflare's `siteverify` endpoint. Two keys, and they are a **pair**:

| Key | Where it lives | Secret? |
|-----|----------------|---------|
| **Site key** (`VITE_TURNSTILE_SITE_KEY`) | frontend client bundle — renders the widget | no, public, ships in HTML |
| **Secret key** (`TURNSTILE_SECRET_KEY`) | backend worker — verifies the token | yes |

The dev/CI test site key `1x00000000000000000000AA` always passes.

## `interaction-only` = invisible for most, escalates when needed

The widget runs in `interaction-only` appearance: for the majority it solves **invisibly** (zero height, no UI) and a token arrives via `callback`. Only when Cloudflare decides the visitor must prove themselves does it surface a real interactive challenge. The callbacks are the whole state machine:

| Callback | Meaning | Our hook does |
|----------|---------|---------------|
| `callback(token)` | solved | set token, clear `needsInteraction` + `errored` |
| `before-interactive-callback` | a **visible** challenge is about to show | set `needsInteraction` |
| `error-callback` | **hard failure**, no challenge shown (network, blocked script, bad key) | clear token, set `errored` |
| `expired-callback` | token aged out (~300s) | clear token; widget re-arms itself — **not** an error |

The trap: people assume every failure escalates to a visible challenge. **It does not.** Escalation fires `before-interactive-callback` (widget appears); a hard error fires `error-callback` (nothing appears). Conflating the two is how you end up with a silently-broken form.

## Tokens are single-use

A token is consumed by one `siteverify`. After a **failed submit**, call `reset()` so a retry gets a fresh token — reusing the old one fails. See the `turnstile.reset()` in the login submit's error branch.

## The gold-standard UX rule

> **A disabled submit button must always have a visible cause on screen.**
> A submit-time error must always mean "something is genuinely wrong."

That single rule resolves every case. Concretely, the hook exposes `token`, `needsInteraction`, and `errored`, and the page derives:

```ts
const turnstileBlocksSubmit =
  turnstile.enabled &&
  !turnstile.token &&
  (turnstile.needsInteraction || turnstile.errored)
```

- **Visible challenge unsolved** (`needsInteraction`) → button disabled; the widget itself is the cause.
- **Hard error** (`errored`) → button disabled; an inline notice is rendered below the widget as the cause.
- **Invisible solve in flight** (`!token`, but neither of the above) → button **stays enabled**. Do **not** disable here: credential entry always outlasts the sub-second solve, so there is no perceptible wait, and disabling would produce a button locked with nothing on screen — the exact anti-pattern the rule forbids.

### Two gotchas that make the rule non-trivial

- **The Enter key bypasses `disabled`.** A field's `onKeyDown` submit handler runs even when the button is disabled, so the submit handler **also** needs the `enabled && !token` guard. Button-disable is the mouse affordance; the handler guard covers the keyboard path and the invisible-solve race.
- **Never gate on `!token` alone.** That disables the button during every invisible solve (and permanently on a hard error) with no visible cause. Gate on `needsInteraction || errored`.

## Test keys — force any state locally

Cloudflare publishes dummy keys that force a fixed outcome, so you can drive every branch above without a real challenge. The site key (client) and secret key (server) are a **matched pair**: a test secret only accepts the dummy token `XXXX.DUMMY.TOKEN.XXXX` and rejects real ones; a production secret rejects the dummy token. Never mix a test site key with a production secret, or vice versa.

Set the site key in `apps/frontend/env/.env` (`VITE_TURNSTILE_SITE_KEY`) and the secret in `apps/backend/env/.env` (`TURNSTILE_SECRET_KEY`).

### Site keys — which client callback fires

| Site key | Widget | Drives |
|----------|--------|--------|
| `1x00000000000000000000AA` | visible | always passes → `callback` → token set (happy path) |
| `1x00000000000000000000BB` | invisible | always passes → `callback` (matches our default `interaction-only` behavior) |
| `2x00000000000000000000AB` | visible | always fails → `error-callback` → our `errored` (inline notice + disabled button) |
| `2x00000000000000000000BB` | invisible | always fails → `error-callback` → `errored` with **no visible widget** (the silent dead-end we guard against) |
| `3x00000000000000000000FF` | visible | forces an interactive challenge → `before-interactive-callback` → our `needsInteraction` (button disabled, widget shown) |

### Secret keys — how `verifyTurnstile` resolves

| Secret key | `siteverify` | Drives |
|------------|--------------|--------|
| `1x0000000000000000000000000000000AA` | always passes | happy path |
| `2x0000000000000000000000000000000AA` | always fails | `captcha_failed` (client sent a token, server rejects it) |
| `3x0000000000000000000000000000000AA` | "token already spent" | `captcha_failed`; also the single-use path — check that `reset()` re-arms the widget for the retry |

Dummy token any test site key returns: `XXXX.DUMMY.TOKEN.XXXX`.

### Which key reproduces which of our states

| To test | Set |
|---------|-----|
| Interactive challenge + button-disable UX | site key `3x…FF` |
| Hard error → `errored` inline notice | site key `2x…AB` (visible) or `2x…BB` (invisible) |
| Server rejection → `captcha_failed` | any passing site key + secret `2x…AA` |
| Single-use token → `reset()` re-arm | secret `3x…AA` |
| `captcha_required` (tokenless) | set the secret, leave the site key **unset** — no widget, no token, reproducing the pairing-drift outage |

## Server: fail closed, and keep the copy honest

`verifyTurnstile` is a **no-op when `TURNSTILE_SECRET_KEY` is unset** (local/CI run without keys) and **enforces when set**: no token → `captcha_required`, rejected token → `captcha_failed`. Fail-closed is correct for a security control — fail-open silently disables abuse protection, which is worse than a visible break.

Error copy must not tell the user to do something that is not on screen (see `core/copywriting`). `captcha_required` fires when **no token was sent**, which from the user's side is "verification did not attach," not "go complete a check." So it reads *"We couldn't verify your browser. Please refresh the page and try again."* — not "Please complete the security check."

## The env pairing invariant — this WILL bite

Site key and secret key are a pair; a **half-configuration is the worst failure mode** because it is silent:

| Site key | Secret key | Result |
|----------|-----------|--------|
| set | set | works |
| **missing** | set | backend enforces, client renders no widget → every signup rejected (visible outage) |
| set | **missing** | widget shows, backend ignores the token → **no protection, and you'd never know** |

When both keys are optional config, nothing fails loudly on drift, so treat them as **both-or-neither**: a check comparing their presence before deploy catches a half-configuration before users do.

The site key is public and lives in the **client bundle**, so with a bundler it must be a **build-time** env var — it cannot be supplied as a runtime server var. If the widget never renders, first confirm the site key value is actually present in the shipped client JS.

## Quick checklist when the widget misbehaves

1. Does the client bundle actually contain the site key value? A blank/absent site key means the widget can't render.
2. Is the backend's secret key set for that same environment? (pairing invariant)
3. Is the failure `captcha_required` (no token sent) or `captcha_failed` (token rejected)? The first points at the client/widget, the second at verification.
4. Zero requests to `challenges.cloudflare.com/turnstile` on `/login` → the script never loaded → the site key was falsy.
