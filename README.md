# Abalone

Abalone in the browser: eight bots to play against, or two people sharing one
screen. There is no account and no server — the rules, the opponent and the
board are all in the tab, and the game keeps working with the network off.

## Running it

```bash
pnpm install
pnpm run dev
```

```bash
pnpm run build
```

The build is a static site in `dist/`. `vite.config.js` sets `base: './'`, so it
can be served from a subpath as happily as from a domain root — which is also
why every path in `index.html` and `site.webmanifest` is relative, and why a
leading `/` in either would quietly undo it.

## What's in it

- **vs Computer** — eight opponents, from one that chases marbles it can't catch
  to one that looks several moves ahead. Difficulty isn't a good player wearing
  a handicap: the weak ones want the wrong things, which is what makes them
  beatable in ways a person can actually find.
- **Pass & Play** — two players on one device.
- **Online** — not built. The button says so rather than pretending.
- **13 languages**, and an illustrated rules page for anyone who has never
  pushed a marble off a hexagon before.

The search is alpha-beta, and it runs in a Web Worker: the bot thinking is the
one thing here that takes real time, and it does it without touching the frame
the board is drawn in.

## Layout

| | |
| --- | --- |
| `src/engine/` | the rules — moves, legality, notation, board setups. Knows nothing about React, and nothing about who is winning |
| `src/ai/` | the bots — search, evaluation, the eight profiles, and the worker they run in |
| `src/render/` | everything drawn to canvas: board, marbles, motion |
| `src/components/` | the interface |
| `src/pages/` | home, rules, game |
| `src/i18n/` | one JSON per language per namespace; keys are ids, never English |
| `public/`, `assets/` | what ships and what it was made from — see [assets/README.md](assets/README.md) |

Two rules hold that layout together. The engine states facts and never judges
them: *which moves are legal* lives in `src/engine/`, *which one is better*
lives in `src/ai/`. And every string on screen comes from `src/i18n/locales/`
under an id, so a copy change is one file and never a grep through JSX.

## Notes

- pnpm, with `pnpm-lock.yaml` committed. `package-lock.json` is in `.gitignore`
  on purpose — two lockfiles is two different node_modules.
- `pnpm-workspace.yaml` exists for one line: pnpm blocks install scripts until
  they're named, and esbuild needs its to pick a native binary.

## Licence

MIT — see [LICENSE](LICENSE).
