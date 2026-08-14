#!/bin/bash
#
# Re-derive crop.json — the square each portrait is framed to.
#
# Only needed when the artwork itself changes. The squares are the ones the
# WebP pipeline used to cut with ImageMagick, kept so the tiles frame the way
# they always have; the recipe and the reasoning behind the numbers are in
# assets/avatars/README.md.
#
# Working backwards from `-trim +repage -gravity north -splice 0xS -gravity
# north -extent NxN`: the square spans x = (w-N)/2 .. (w+N)/2 and y = -S ..
# N-S in trimmed-content coordinates, which maps back to the render by adding
# the trim origin and to viewBox units by the 955/900 render scale.
#
# Needs Chrome and ImageMagick. Chrome does the rendering because ImageMagick's
# own SVG renderer flattens the transparency this measurement depends on.
set -euo pipefail

HERE="$(cd "$(dirname "$0")" && pwd)"
ART="$HERE/../../assets/avatars"
CHROME="${CHROME:-/Applications/Google Chrome.app/Contents/MacOS/Google Chrome}"
WORK="$(mktemp -d)"
trap 'rm -rf "$WORK"' EXIT

for tool in magick python3; do
  command -v "$tool" >/dev/null || { echo "missing $tool" >&2; exit 1; }
done
[ -x "$CHROME" ] || { echo "missing Chrome at $CHROME" >&2; exit 1; }

{
  echo "{"
  first=1
  for file in "$ART"/*.svg; do
    name=$(basename "$file" .svg)
    # clara's hair is wider than her shoulders, so her square is wider than the
    # artwork and pads with transparency at the sides — see the README
    if [ "$name" = "clara" ]; then N=1060; S=63; else N=900; S=54; fi

    printf '<style>html,body{margin:0;padding:0}img{display:block;width:900px}</style><img src="%s">' \
      "$file" > "$WORK/$name.html"
    "$CHROME" --headless --disable-gpu --hide-scrollbars --force-device-scale-factor=1 \
      --default-background-color=00000000 --window-size=900,1101 \
      --screenshot="$WORK/$name.png" "file://$WORK/$name.html" >/dev/null 2>&1

    read -r w h x0 y0 <<<"$(magick "$WORK/$name.png" -format "%@" info: | tr 'x+' '  ')"
    [ $first -eq 0 ] && echo ","
    first=0
    python3 -c "
scale = 955.0 / 900.0
left = ($x0 + ($w - $N) / 2.0) * scale
top  = ($y0 - $S) * scale
size = $N * scale
print('  \"$name\": \"%.1f %.1f %.1f %.1f\"' % (left, top, size, size), end='')
"
  done
  echo
  echo "}"
} > "$HERE/crop.json"

echo "wrote $HERE/crop.json"
