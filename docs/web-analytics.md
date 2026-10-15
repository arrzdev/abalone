# Web analytics

Page views and visitors come from Cloudflare Web Analytics. Games started come
from our own table, [game-events.md](game-events.md). The two answer different
questions: who visits, and who plays.

## The beacon

The game loads Cloudflare's beacon in the browser:

```html
<script defer src="https://static.cloudflareinsights.com/beacon.min.js"
  data-cf-beacon='{"token":"<site token>"}'></script>
```

- `startWebAnalytics` (`apps/game/src/utils/web-analytics.ts`) adds it to the
  page head once, from the client entry (`apps/game/src/client.tsx`). It is not
  in the server-rendered HTML.
- The beacon is told the token and nothing else. It sets no cookie and keeps
  nothing in `localStorage`, so it needs no consent banner. Cloudflare says so:
  "Cloudflare Web Analytics does not use any client-side state, such as cookies
  or localStorage, to collect usage metrics"
  (<https://www.cloudflare.com/web-analytics/>).
- Off when the build has no token: dev, the e2e build and CI builds.
- Off when a test drives the browser (`navigator.webdriver`), the same rule game
  events use, so our e2e and smoke checks against production are not visitors.

## The token

`VITE_CF_WEB_ANALYTICS_TOKEN` in the game's env schema. It is a Web Analytics
site token, public by design (it is in every page), so it is a GitHub
Environment **variable** on `production`, not a secret. The deploy writes it
into `apps/game/env/.env` from the schema, and Vite bakes it into the bundle.
`.env.example` leaves it empty.

The site is added in the Cloudflare dashboard (Web Analytics, hostname
`abalone.tudu.dev`). The beacon matches the hostname by suffix, so the one site
covers only `abalone.tudu.dev`; `babaluje.tudu.dev` is a different name and is
not counted. Its pages point their canonical at `abalone.tudu.dev` anyway.

## Reading it

Cloudflare dashboard → Web Analytics → `abalone.tudu.dev`: visits, page views,
top pages, referrers and countries, by day. Weekly players come from
[game-events.md](game-events.md) "Weekly games started".
