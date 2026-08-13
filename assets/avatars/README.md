# Avatar sources

The vector original of each bot's portrait, kept here rather than in `public/`
so it is archived without being shipped. The game loads the WebP built from it
at `public/images/avatars/<id>.webp`.

Named after the character, not the level — reordering the ladder should move a
face up it, not repaint someone else's.

## Rebuilding a portrait

Render the SVG at width 900 (Chrome headless; ImageMagick's own SVG renderer
flattens the transparency), then:

```bash
magick source.png -trim +repage -background none \
  -gravity north -splice 0x54 \
  -gravity north -extent 900x900 \
  -resize 256x256 -strip -quality 82 -define webp:method=6 \
  ../../public/images/avatars/<id>.webp
```

`-trim` first, so framing is measured from the ink rather than from whatever
margin the export happened to leave.

## Choosing the square

The square is what decides how much of the bust survives, and it is **not** the
content width. Tall hair is wider than the shoulders, so sizing the square to
the drawing's widest point crops a portrait like Clara's off at the neck — the
mistake that made her the odd one out.

Size it by how much of the tile's bottom edge the body fills:

```bash
magick <id>.webp -alpha extract -crop 256x1+0+255 +repage -format "%[fx:mean*100]" info:
```

The roster sits between 70% and 96%. Below that the crop has stopped above the
shoulders and the head floats. The number also saturates — past the point where
the shoulders are in frame, a bigger square buys no more body and only shrinks
the face, so take the smallest square that clears 70%.

Seven portraits land there at `-extent 900x900` with `-splice 0x54`. Clara's
hair needs `-extent 1060x1060` with `-splice 0x63` (headroom is 6% of the
square); the sides pad with transparency, which is why her square may exceed
her artwork's width.
