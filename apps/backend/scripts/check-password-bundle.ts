import { readFileSync } from "node:fs"

//better-auth hashes passwords with scrypt from @better-auth/utils/password. that
//package ships two builds: native node:crypto (password.node.mjs) and pure-JS
//@noble/hashes (password.mjs). only the native one fits the Workers CPU budget
//on sign-up/sign-in, and wrangler picks it through the `workerd` export
//condition. a resolver change once shipped the pure-JS one instead
//(better-auth#9649), so the build fails if the bundle does not hold the native
//build or does hold the pure-JS scrypt.
//
//reads the esbuild metafile that `pnpm build` writes (wrangler --metafile).

const METAFILE = process.argv[2] ?? "dist/bundle-meta.json"

type Metafile = { inputs: Record<string, unknown> }

const meta = JSON.parse(readFileSync(METAFILE, "utf8")) as Metafile
const inputs = Object.keys(meta.inputs)

const nativeHash = inputs.filter((file) =>
  file.endsWith("@better-auth/utils/dist/password.node.mjs"),
)
const pureJsScrypt = inputs.filter(
  (file) =>
    file.includes("@noble/hashes/") && /\/scrypt\.m?js$/.test(file),
)
const pureJsHash = inputs.filter((file) =>
  file.endsWith("@better-auth/utils/dist/password.mjs"),
)

const problems: string[] = []
if (nativeHash.length === 0)
  problems.push(
    "missing @better-auth/utils/dist/password.node.mjs (native scrypt)",
  )
for (const file of [...pureJsScrypt, ...pureJsHash])
  problems.push(`pure-JS password hashing bundled: ${file}`)

if (problems.length > 0) {
  console.error(`password bundle check failed (${METAFILE}):`)
  for (const problem of problems) console.error(`  - ${problem}`)
  process.exit(1)
}

console.log(`password bundle check ok: ${nativeHash[0]}`)
