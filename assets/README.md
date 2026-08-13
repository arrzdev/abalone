# Assets

Two places, and the difference between them is whether the browser ever asks
for the file.

**`assets/`** — sources. Vectors and notes, archived with the code and never
served. Nothing in here is referenced by the app, so nothing in here can break
it; it is what you come back to when a shipped file has to be remade.

| | |
| --- | --- |
| `assets/avatars/*.svg` | the vector original of each bot's portrait — see [its README](avatars/README.md) for how a WebP is rebuilt from one |
| `assets/logo.svg` | the wordmark |
| `assets/audio/README.md` | where the two board recordings came from and why they are played the way they are |

**`public/`** — what ships. Vite copies this verbatim into `dist/`, so the paths
below are the URLs, and renaming anything here means finding every reference to
it by hand.

| | |
| --- | --- |
| `public/audio/marble-move.m4a` | marbles sliding one square |
| `public/audio/marble-fall.m4a` | a marble going over the rim |
| `public/images/avatars/<id>.webp` | bot portraits, named after the character — `src/i18n/bots.js` builds the path from the bot's id |
| `public/icons/` | favicons, the apple-touch icon, and the two PWA icons, linked from `index.html` and `site.webmanifest` |
| `public/favicon.ico` | at the root, alone, because it is the one icon a browser asks for without being told |
| `public/site.webmanifest` | name, colours and icons for an installed copy |

Paths in `index.html` and the manifest are relative on purpose: `vite.config.js`
sets `base: './'` so the build works under a subpath, and a leading `/` anywhere
in here would quietly undo that.

Anything the app imports rather than fetches — the marble renderer, the board —
is drawn in code under `src/render/`, and is not an asset at all.
