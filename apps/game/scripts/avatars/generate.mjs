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

  // a standalone file the page fetches as an <img>, so the root needs its own
  // namespace and nothing else: the size comes from the caller's class
  const body = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${viewBox}">${inner.trim()}</svg>\n`
  writeFileSync(join(TARGET, `${id}.gen.svg`), body)
  console.log(`${id}.gen.svg  ${(body.length / 1024).toFixed(1)} KiB`)
}
