import fs from "fs"
import path from "path"
import postcss from "postcss"

import tailwindcss, { type Config as TailwindConfig } from "tailwindcss"
import { rollup } from "rollup"
import { pathToFileURL } from "url"

import typescript from "rollup-plugin-typescript2"
import nodeResolve from "@rollup/plugin-node-resolve"
import CleanCSS from "clean-css"
import { format } from "prettier"
import { minify } from "terser"
import { RAW_STRING_STYLE_SHEET_PLACEHOLDER } from "@/system/plugin"
import { getSharedConstants, createErrorLogger, logMajorInfo } from "@/cli/base"
import commonjs from "@rollup/plugin-commonjs"

const PATH_CONFIGS = (async () => {
  const { OUTERBASE_PATH, GENERATED_FILES_PATH } = await getSharedConstants()

  const PLUGINS_PATH = path.join(OUTERBASE_PATH, "plugins")
  const PLUGINS_OUTPUT_DIR = path.join(GENERATED_FILES_PATH, "plugins")
  const PLUGINS_TAILWIND_CONFIG_PATH = path.join(
    PLUGINS_PATH,
    "tailwind.config.js"
  )

  return { PLUGINS_PATH, PLUGINS_TAILWIND_CONFIG_PATH, PLUGINS_OUTPUT_DIR }
})()

const PLUGIN_FILE_CONVENTIONS = {
  ENTRY_FILE: "main.ts",
  STYLE_SHEET: "stylesheet.css"
} as const

const RollupTSPluginOptions: Parameters<typeof typescript>[0] = {
  check: false,
  clean: true,
  tsconfigOverride: {
    compilerOptions: {
      module: "esnext"
    }
  }
}

const BUILD_OPTIONS = (() => {
  const options = process.argv.slice(2)
  const pluginBasenames = options
    .filter((arg) => arg.startsWith("--plugin="))
    .map((arg) => arg.substring("--plugin=".length))

  const minifyOutput = options.includes("--minify")
  return { pluginBasenames, minifyOutput }
})()

const getPluginSrcString = async (basename: string) => {
  const { PLUGINS_PATH } = await PATH_CONFIGS
  const entryFile = path.join(
    PLUGINS_PATH,
    basename,
    PLUGIN_FILE_CONVENTIONS.ENTRY_FILE
  )

  const bundle = await rollup({
    input: entryFile,
    plugins: [nodeResolve(), commonjs(), typescript(RollupTSPluginOptions)]
  })

  const code = await bundle.generate({}).then((output) => output.output[0].code)
  await bundle.close()

  // Prevent clashing of variables by wrapping in iife
  const iifeWrappedCode = `
    (function() {
      ${code}
    })()
  `

  return iifeWrappedCode
}

const getPluginStyles = async (basename: string, srcString: string) => {
  const { PLUGINS_PATH, PLUGINS_TAILWIND_CONFIG_PATH } = await PATH_CONFIGS
  const tailwindConfigImport = (await import(
    pathToFileURL(PLUGINS_TAILWIND_CONFIG_PATH).href
  )) as { default: Readonly<TailwindConfig> }

  const tailwindConfig = {
    ...tailwindConfigImport.default,
    content: [{ raw: srcString }]
  }

  const styleSheetPath = path.join(
    PLUGINS_PATH,
    basename,
    PLUGIN_FILE_CONVENTIONS.STYLE_SHEET
  )
  const pluginStyleSheet = fs.readFileSync(styleSheetPath, "utf-8")

  let { css } = await postcss([tailwindcss(tailwindConfig)]).process(
    pluginStyleSheet,
    { from: styleSheetPath }
  )

  const { minifyOutput } = BUILD_OPTIONS
  if (minifyOutput) css = new CleanCSS().minify(css).styles

  return css
}

const insertOutputStyleSheet = (pluginSrc: string, styleSheet: string) => {
  const TEMPLATER_REPLACER = /\${/g
  // eslint-disable-next-line no-template-curly-in-string
  const TEMPLATER_REPLACEMENT = "${'${'}"

  const BACKTICK_REPLACER = /`/g
  // eslint-disable-next-line no-template-curly-in-string
  const BACKTICK_REPLACEMENT = "${'`'}"

  /**
   * This replace is needed because the string is used in a `css` tagged
   * template string. Backticks must be replaced with ${"`"} as the `css`
   * function returns the raw string. If we replace "`" with "\\`", then the
   * forward slash will be a part of the output.
   *
   * The templater must first be replaced, since backtick replacement generates
   * additional templaters which may result in errors. This also means that the
   * replacement for templaters must not contain backticks too.
   */
  const rawStringStyleSheet = styleSheet
    .replace(TEMPLATER_REPLACER, TEMPLATER_REPLACEMENT)
    .replace(BACKTICK_REPLACER, BACKTICK_REPLACEMENT)

  return pluginSrc.replace(
    RAW_STRING_STYLE_SHEET_PLACEHOLDER,
    rawStringStyleSheet
  )
}

const writePluginToFile = async (basename: string, src: string) => {
  const { minifyOutput } = BUILD_OPTIONS
  const outputFileExtension = minifyOutput ? ".bundle.min.js" : ".bundle.js"

  const { PLUGINS_OUTPUT_DIR } = await PATH_CONFIGS
  const filePathToWrite = path.join(
    PLUGINS_OUTPUT_DIR,
    `${basename}${outputFileExtension}`
  )

  await fs.promises.mkdir(PLUGINS_OUTPUT_DIR, { recursive: true })
  await fs.promises.writeFile(filePathToWrite, src)
}

const finalizePluginSrc = async (srcString: string) => {
  const { minifyOutput } = BUILD_OPTIONS

  if (!minifyOutput) {
    const prettifiedSource = await format(srcString, {
      parser: "babel"
    })

    return prettifiedSource
  }

  const minifiedSource = (await minify(srcString)).code
  return minifiedSource ?? ""
}

const buildPlugin = async (basename: string) => {
  // eslint-disable-next-line no-console
  console.log("Building plugin:", basename)
  const srcString = await getPluginSrcString(basename)
  const styleSheet = await getPluginStyles(basename, srcString)

  const srcWithStyleSheet = insertOutputStyleSheet(srcString, styleSheet)
  const finalSource = await finalizePluginSrc(srcWithStyleSheet)
  await writePluginToFile(basename, finalSource)
}

const RunOuterduePluginBuildProcess = async () => {
  const { pluginBasenames } = BUILD_OPTIONS

  if (pluginBasenames.length === 0) {
    throw new Error(
      [
        "No plugins to process",
        "You might be using the wrong syntax.",
        "The syntax is `--plugin=image-grid` (to process a plugin in the `image-grid` folder)",
        "Remember to use `--` as in `-- --plugin=image-grid` if using an npm script",
        "You may also need to pass multiple `--` if calling this script from nested npm script"
      ].join("\n")
    )
  }

  await Promise.all(pluginBasenames.map((basename) => buildPlugin(basename)))
}

// eslint-disable-next-line @typescript-eslint/naming-convention
export const OUTERDUE_PLUGIN_BUILD__CMD_RUNNER = async () => {
  try {
    await RunOuterduePluginBuildProcess()
    logMajorInfo("Plugin Build Process Successful")
    process.exit(0)
  } catch (error) {
    createErrorLogger("Plugin Build Error")(error)
    process.exit(1)
  }
}
