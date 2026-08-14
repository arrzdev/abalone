# Avatar sources

The vector original of each bot's portrait. These are the source the game
actually draws from: `pnpm --filter @repo/game avatars` optimizes them and
writes one React component per character into
`src/components/avatars/<id>.gen.tsx`, which `components/bot-avatar.tsx` picks
between by id.

Named after the character, not the level — reordering the ladder should move a
face up it, not repaint someone else's.

## Rebuilding the components

```bash
pnpm --filter @repo/game avatars
```

Edit the SVG, re-run that, commit both. Never edit a `.gen.tsx` by hand.

The step is deliberately not part of `build`: it shells out to `svgo` through
`pnpm dlx` rather than adding a dependency, and the art changes about as often
as the roster does.

What it does, and why each part is load-bearing:

- **Optimizes at `floatPrecision: 1`.** Measured against the originals at 256px,
  precision 1 costs 0.45–0.53% RMSE and precision 0 costs 1.3–2.0% — the jump is
  integer rounding opening hairline seams between fills that used to share an
  edge. Precision 1 is invisible; precision 0 is not.
- **Prefixes every id with the character's name.** All eight portraits mount
  into one document in the opponent grid, and each file numbers its own ids from
  `a`. Without the prefix, `url(#a)` resolves to whichever face rendered first
  and the roster borrows each other's gradients.
- **Drops `width`/`height`, keeps the viewBox.** The size comes from the class
  the caller passes, the way `Logo` takes one.
- **Applies the square from `crop.json`** (below).

## Choosing the square

The art is a 955x1168 portrait; a tile shows a square cut out of it. The square
is what decides how much of the bust survives, and it is **not** the content
width. Tall hair is wider than the shoulders, so sizing the square to the
drawing's widest point crops a portrait like Clara's off at the neck — the
mistake that made her the odd one out.

Size it by how much of the tile's bottom edge the body fills:

```bash
magick <render>.png -alpha extract -crop 256x1+0+255 +repage -format "%[fx:mean*100]" info:
```

The roster sits between 70% and 96%. Below that the crop has stopped above the
shoulders and the head floats. The number also saturates — past the point where
the shoulders are in frame, a bigger square buys no more body and only shrinks
the face, so take the smallest square that clears 70%.

Seven portraits land there on a 900px square with 54px of headroom spliced on
top. Clara's hair needs 1060px with 63px (headroom is 6% of the square); the
sides pad with transparency, which is why her square may exceed her artwork's
width — in viewBox terms it starts left of zero.

`scripts/avatars/crop.json` holds the result, and
`scripts/avatars/measure-crop.sh` re-derives it when the artwork changes. That
script needs Chrome and ImageMagick — Chrome does the rendering because
ImageMagick's own SVG renderer flattens the transparency the measurement reads.

## History

Until these became components the game shipped 256px WebP crops from
`public/images/avatars/`, built by the same square. The crop survived the move;
the raster step did not.
