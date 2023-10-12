import fs from "fs"
import path from "path"
import postcss from "postcss"

import tailwindcss, { type Config as TailwindConfig } from "tailwindcss"
import { rollup } from "rollup"
import { pathToFileURL } from "url"

import typescript from "@rollup/plugin-typescript"
import nodeResolve from "@rollup/plugin-node-resolve"
import CleanCSS from "clean-css"
import { format } from "prettier"
import { minify } from "terser"
import { RAW_STRING_STYLE_SHEET_PLACEHOLDER } from "@/system/plugin"
import {
  getSharedConstants,
  createErrorLogger,
  logMajorInfo,
  getCommandCLIUnnamedOptions,
  defineCommandCLINamedOptions,
  getOuterdueConfigOptions,
  parseCommandCLINamedOptions
} from "@/cli/base"
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

const PLUGIN_BUILD_COMMAND_CLI_INPUT = "outerdue plugin build"
const PluginBuildCommandNamedOptions = defineCommandCLINamedOptions({
  minify: { type: "boolean", required: false, short: "m" }
})

const BUILD_OPTIONS = (async () => {
  const pluginBasenames = getCommandCLIUnnamedOptions(
    PLUGIN_BUILD_COMMAND_CLI_INPUT
  )

  const outerdueConfigOptions = await getOuterdueConfigOptions()
  const namedOptionsParseResult = parseCommandCLINamedOptions({
    options: PluginBuildCommandNamedOptions,
    noUnnamedOptions: false,
    command: PLUGIN_BUILD_COMMAND_CLI_INPUT
  })

  const minifyOutput =
    namedOptionsParseResult.minify ?? outerdueConfigOptions.plugin.minify

  return { pluginBasenames, minifyOutput }
})()

const getRollupTSPlugin = () =>
  typescript({
    outputToFilesystem: true,
    compilerOptions: {
      declaration: false,
      module: "esnext",
      moduleResolution: "bundler"
    }
  })

const getPluginSrcString = async (basename: string) => {
  const { PLUGINS_PATH } = await PATH_CONFIGS
  const entryFile = path.join(
    PLUGINS_PATH,
    basename,
    PLUGIN_FILE_CONVENTIONS.ENTRY_FILE
  )

  const bundle = await rollup({
    input: entryFile,
    plugins: [nodeResolve(), commonjs(), getRollupTSPlugin()]
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

  const { minifyOutput } = await BUILD_OPTIONS
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
  const { minifyOutput } = await BUILD_OPTIONS
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
  const { minifyOutput } = await BUILD_OPTIONS

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
  const { pluginBasenames } = await BUILD_OPTIONS

  if (pluginBasenames.length === 0) {
    throw new Error("Please specify basenames of plugins to process")
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
