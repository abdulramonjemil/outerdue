import typescript from "@rollup/plugin-typescript"
import path from "path"

const NODE_SHEBANG = "#!/usr/bin/env node"

/** @typedef {import("rollup").RollupOptions} RollupOptions */

/**  @returns {RollupOptions["plugins"]} */
const getTSFilePluginsConfig = () => [
  typescript({
    outputToFilesystem: true,
    compilerOptions: {
      declaration: false,
      module: "esnext",
      moduleResolution: "bundler"
    }
  })
]

/** @type {RollupOptions} */
const CommandSystemCompilationOptions = {
  input: "src/system/command/index.ts",
  plugins: getTSFilePluginsConfig(),

  output: [
    {
      file: "dist/system/cjs/command.js",
      format: "cjs",
      esModule: "if-default-prop",
      sourcemap: true
    },
    {
      file: "dist/system/esm/command.js",
      format: "esm",
      sourcemap: true
    }
  ]
}

/** @type {RollupOptions} */
const PluginSystemCompilationOptions = {
  input: "src/system/plugin/index.ts",
  plugins: getTSFilePluginsConfig(),

  output: [
    {
      file: "dist/system/cjs/plugin.js",
      format: "cjs",
      esModule: "if-default-prop",
      sourcemap: true
    },
    {
      file: "dist/system/esm/plugin.js",
      format: "esm",
      sourcemap: true
    }
  ]
}

/** @satisfies {RollupOptions} */
export const OuterdueCommandCompilationOptions = {
  input: "src/cli/index.ts",
  plugins: getTSFilePluginsConfig(),
  output: [
    {
      banner: (chunk) => {
        const CLIEntry = path.join(process.cwd(), "src/cli/index.ts")
        if (chunk.facadeModuleId === CLIEntry) return `${NODE_SHEBANG}\n`
        return ""
      },
      dir: "dist/cli",
      format: "cjs",
      chunkFileNames: "[name]-[hash:12].js",
      manualChunks: {
        "command.proxy": ["src/cli/command/base/proxy.ts"]
      }
    }
  ]
}

/** @type {RollupOptions[]} */
const options = [
  CommandSystemCompilationOptions,
  PluginSystemCompilationOptions,
  OuterdueCommandCompilationOptions
]

export default options
