# Assets

Two places, and the difference between them is whether the browser ever asks
for the file.

**`assets/`** — sources. Vectors and notes, archived with the code and never
served. Nothing in here is referenced by the app, so nothing in here can break
it; it is what you come back to when a shipped file has to be remade.

| | |
| --- | --- |
| `assets/avatars/*.svg` | the vector original of each bot's portrait — see [its README](avatars/README.md) for how a WebP is rebuilt from one |
| `assets/logo.svg` | the mark on its full 1080 canvas. The shipped favicons are the same six paths, cropped |
| `assets/audio/README.md` | where the two board recordings came from and why they are played the way they are |

**`public/`** — what ships. Vite copies this verbatim into `dist/`, so the paths
below are the URLs, and renaming anything here means finding every reference to
it by hand.

| | |
| --- | --- |
| `public/audio/marble-move.m4a` | marbles sliding one square |
| `public/audio/marble-fall.m4a` | a marble going over the rim |
| `public/images/avatars/<id>.webp` | bot portraits, named after the character — `src/i18n/bots.ts` builds the path from the bot's id |
| `public/favicons/` | the whole icon set: `favicon.ico`, the PNG favicons, the apple-touch and android icons, `favicon-light.svg` and `favicon-dark.svg`, and `pinned-tab.svg` for a Safari pinned tab |
| `public/_pwa/offline-fallback.html` | what the service worker serves when a navigation misses both the network and the cache (`src/sw.ts` passes the path as `offlineFallbackPath`) |

Both folders are this app's own — `apps/game/assets/` and `apps/game/public/`,
not the monorepo root's.

No file in `apps/game/` links an icon. `@repo/nativ` writes the head links from
its own list (`defaultFaviconLinks`), and `nativ.config.ts` only points it at the
folder. There is no manifest file here either: nativ generates `/manifest.json`
from `nativ.config.ts`, served in dev and emitted at build. It collects the icons
by filename, so a new PWA icon only reaches the manifest if it is called
`android-icon-<size>x<size>.png` or `android-chrome-<size>.png`.

`vite.config.ts` sets no `base`, so all of this is served from the site root and
the URLs in the head are absolute (`/favicons/favicon.ico`, `/manifest.json`).
Code that builds its own path goes through `import.meta.env.BASE_URL`, the way
`src/i18n/bots.ts` does, and keeps working if a base is ever set.

Anything the app imports rather than fetches — the marble renderer, the board —
is drawn in code under `src/render/`, and is not an asset at all.
