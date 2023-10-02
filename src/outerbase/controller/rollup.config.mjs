import typescript from "rollup-plugin-typescript2"

/**
 * This config file is only meant to be used with generator scripts to define
 * plugins to use when bundling them.
 */

/** @type {import("rollup").RollupOptions} */
const config = {
  plugins: [
    typescript({
      check: false,
      clean: true,
      tsconfigOverride: {
        compilerOptions: {
          module: "esnext"
        }
      }
    })
  ]
}

export default config
