import { basename } from "node:path"

// precision 1 measured at 0.45-0.53% RMSE against the originals, precision 0 at
// 1.3-2.0% where integer rounding opens hairline seams between adjacent fills
export default {
  multipass: true,
  floatPrecision: 1,
  plugins: [
    {
      name: "preset-default",
      params: { overrides: { removeViewBox: false } },
    },
    // the size comes from the caller's class, not from the file
    "removeDimensions",
    // every file numbers its own ids from "a", and all eight render in one grid
    {
      name: "prefixIds",
      params: {
        delim: "",
        prefix: (_node, info) =>
          basename(info.path ?? "svg").replace(/\.svg$/, ""),
      },
    },
  ],
}
