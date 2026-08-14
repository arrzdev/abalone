import {
  mkdirSync,
  readdirSync,
  readFileSync,
  writeFileSync,
} from "node:fs"
import { basename, join } from "node:path"

const SOURCE = process.argv[2]
const TARGET = process.argv[3]

// the square each portrait is framed to, derived by crop.sh from the magick
// recipe in assets/avatars/README.md rather than chosen here — the source art
// is a 955x1168 full portrait and the tiles have always shown a square of it
const CROP = JSON.parse(readFileSync(process.argv[4], "utf8"))

// the closed set of attributes svgo leaves on this artwork, checked against the
// optimized output rather than assumed: anything not listed here is a new shape
// the generator has not been taught and must fail loudly instead of emitting
// invalid jsx
const JSX_ATTRIBUTES = {
  "fill-opacity": "fillOpacity",
  "stop-color": "stopColor",
  "clip-path": "clipPath",
}
const PASS_THROUGH = new Set([
  "d",
  "fill",
  "offset",
  "id",
  "transform",
  "gradientUnits",
  "viewBox",
  "x1",
  "x2",
  "y1",
  "y2",
])

function toComponentName(id) {
  return `${id[0].toUpperCase()}${id.slice(1)}Avatar`
}

function toJsx(markup, file) {
  return markup.replace(
    /([a-zA-Z][a-zA-Z0-9-]*)=/g,
    (whole, attribute) => {
      if (JSX_ATTRIBUTES[attribute]) return `${JSX_ATTRIBUTES[attribute]}=`
      if (PASS_THROUGH.has(attribute)) return whole
      throw new Error(`${file}: unmapped attribute "${attribute}"`)
    },
  )
}

mkdirSync(TARGET, { recursive: true })

const files = readdirSync(SOURCE).filter((name) => name.endsWith(".svg"))
for (const file of files) {
  const id = basename(file, ".svg")
  const source = readFileSync(join(SOURCE, file), "utf8")

  const open = source.match(/<svg\b([^>]*)>/)
  if (!open) throw new Error(`${file}: no root svg element`)
  const viewBox = CROP[id]
  if (!viewBox) throw new Error(`${file}: no crop square`)

  const inner = source
    .slice(open.index + open[0].length)
    .replace(/<\/svg>\s*$/, "")

  const component = toComponentName(id)
  const body = `import type { SVGProps } from "react"

/**
 * ${component[0]}${component.slice(1).replace(/Avatar$/, "")}, drawn rather than fetched.
 *
 * Generated from \`assets/avatars/${file}\` — edit the source and re-run the
 * generator, never this file. Every id inside it is prefixed with the
 * character's name because all eight portraits share one screen in the
 * opponent grid, and \`url(#a)\` would otherwise resolve to whichever face the
 * document happened to mount first.
 *
 * The viewBox is a square cut out of a 955x1168 portrait, not the whole
 * drawing: it is the crop \`assets/avatars/README.md\` describes, carried over
 * from when this was rendered to WebP so the tiles frame the same way they
 * always have. That is also why it may start left of zero or above it — the
 * square is allowed to be wider than the artwork, and the space pads with
 * transparency.
 *
 * Decorative: the name is spelled out beside every place this appears.
 */
export function ${component}(props: SVGProps<SVGSVGElement>) {
  return (
    <svg
      viewBox="${viewBox}"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
      {...props}
    >
      ${toJsx(inner, file)}
    </svg>
  )
}
`
  writeFileSync(join(TARGET, `${id}.gen.tsx`), body)
  console.log(`${id}.gen.tsx  ${(body.length / 1024).toFixed(1)} KiB`)
}
