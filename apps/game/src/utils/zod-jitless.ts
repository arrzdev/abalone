import { z } from "zod"

//zod compiles object parsers with `new Function` unless told not to, and the
//first object schema it builds probes for that with a throwaway
//`Function("")`. the site's CSP has no 'unsafe-eval', so the probe alone files
//a violation report. jitless skips the probe and the compiled parsers; zod
//reads the flag when a schema is built, so this module is imported first by
//the client entry, and vite.config.ts bundles it into zod's own chunk: imported
//first is not run first once the bundler hoists shared modules into chunks the
//entry chunk imports.
z.config({ jitless: true })
