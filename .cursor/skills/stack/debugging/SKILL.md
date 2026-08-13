---
name: debugging
description: >-
  Capture runtime/device logs without manual handoff via a standalone LAN log sink any app/language posts to. Load for debugging, device/PWA bugs, console logs, telemetry, "I can't see the logs", reproducing on a real device.
---

# Debugging & device telemetry

**Principle: never make the human relay logs by hand.** When a bug needs runtime values — especially on a real device — instrument the code to ship logs somewhere *you* can read, then reproduce and read them yourself. Hand-typed values are slow, lossy, and a last resort. (Pairs with `stack/gotchas` → "trust the device over the simulator".)

## Self-test in an isolated browser first (not the human's environment)

When *you* need to drive the app to check a change, reach for an **isolated headless browser you control** — never the human's real Chrome or simulator by default:

| Reach for | When |
|-----------|------|
| **Playwright MCP** (`.mcp.json` → `playwright`; runs headless + isolated) | Ad-hoc agent-driven clicking/asserting on the running app — the default. Replaces `claude-in-chrome` for self-tests. |
| **`pnpm test:e2e`** (Playwright, root `e2e/`, chromium + webkit) | A repeatable smoke/flow worth committing. `E2E_BASE_URL` overrides the target. |
| **iOS Simulator** (`ios-simulator` MCP) | *Escalation only* — WebKit/device-only quirks that don't reproduce headless (text overlays, loupe, settle-snap, iOS scroll/viewport). Then use the log sink below. |
| **claude-in-chrome / computer-use / real Chrome** | Only when the human asks, or the task needs his real session (logins, extensions). |

- Prefer the **WebKit** engine (Playwright `--browser=webkit` / the `webkit` project) for this iOS-PWA — but it's desktop WebKit, so treat it as *close to* Mobile Safari, not identical.
- Running the app yourself? **Isolate ports first** so you don't fight the human's `pn run dev` — remap each app's `ports.ts`, then roll back before handoff (`stack/gotchas` → "Dev ports").

## The dev log sink (one stream, any language)

A standalone HTTP server collects logs from every app in the monorepo — frontend, backend, a Python job, a future Swift app — over the LAN. **Dev-only infrastructure, never shipped.**

| Piece | Where |
|-------|-------|
| Sink server | `@repo/dev/log-sink` (`startLogSink()`); run with `pnpm logs` |
| Shared contract | `@repo/dev/log-sink-port` (`LOG_SINK_PORT`, `LOG_PATH`) |
| LAN IP helper | `@repo/dev/lan-ip` (`getLanIp()`) |
| Browser producer | `apps/frontend/src/dev/debug-telemetry.ts` (`installDebugTelemetry()`) — auto-installed in dev from `entrypoint/client.tsx` |
| Output | sink **stdout** + appended `.dev-logs/sink.log` (gitignored) |

### Contract — POST `/__log`

Any producer, any language, sends JSON:

```jsonc
{ "source": "frontend", "level": "error", "message": "…", "data": {}, "ts": 1730000000000, "url": "…" }
```

- Sink binds `0.0.0.0:<LOG_SINK_PORT>` (default **9999**) and allows cross-origin (`CORS *`) so a device browser can post.
- The browser producer posts via `navigator.sendBeacon` with `text/plain` — a CORS-"simple" request that **skips the preflight** a JSON `fetch` triggers (which the browser drops silently if it fails). The sink also handles `OPTIONS` as a fallback.
- A page at `http://<machine-ip>:7171` reaches the sink at `http://<machine-ip>:9999` automatically via `location.hostname`.

## Debug a device bug (no handoff)

1. Start the sink in the background: `pnpm logs` (then read its stdout, or tail `.dev-logs/sink.log`).
2. Make sure the dev server is reachable on the LAN (Vite `--host` / `0.0.0.0`) and the device loads `http://<machine-ip>:7171`.
3. The browser producer auto-forwards `console.*`, `window.onerror`, and unhandled rejections in dev — add targeted `console.log`s for the values you need.
4. Reproduce on the device; **read the sink output yourself**; iterate.
5. Remove temporary debug logs before handoff (`core/custom-errors`: prod logging lives only in the global handler).

## Add a producer in another language

POST the contract above to `http://<machine-ip>:<LOG_SINK_PORT>/__log`. Python → `requests.post(...)`; Swift → `URLSession`. No shared package needed — the HTTP contract *is* the integration point (`core/polyglot-monorepo`).

## Limits

- HTTP + LAN only (your machine must be reachable from the device). A page served over **https** cannot post to the http sink (mixed content) — point the producer at a hosted endpoint for that (the producer's sink URL is configurable).
- Dev-only: `installDebugTelemetry()` is stripped from production builds via `import.meta.env.DEV`.
