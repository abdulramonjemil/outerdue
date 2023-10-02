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
// @ts-expect-error Rollup processes this file successfully, so it's fine to
// ignore typescript's error of the file being a commonJS module and terser
// being an ES module
import { minify } from "terser"
import { RAW_STRING_STYLE_SHEET_PLACEHOLDER } from "./base"

// Current working directory should be the project's root directory
const PLUGINS_PARENT_PATH = path.join(process.cwd(), "src/outerbase/plugins")
const PLUGINS_TAILWIND_CONFIG_PATH = path.join(
  PLUGINS_PARENT_PATH,
  "tailwind.config.js"
)

const PLUGIN_FILE_CONVENTIONS = {
  ENTRY_FILE: "main.ts",
  STYLE_SHEET: "stylesheet.css"
} as const

const PLUGINS_OUTPUT_DIR = path.join(
  process.cwd(),
  "outerbase/generated/plugins"
)

const logError = (...message: unknown[]) => {
  // eslint-disable-next-line no-console
  console.error(
    "---> Outerbase Plugin Generator Error:",
    "\n\n",
    "Plain error:",
    ...message,
    "\n\n",
    "Error as string:",
    ...message.map((val) => String(val))
  )
}

const RollupTSPluginOptions: Parameters<typeof typescript>[0] = {
  check: false,
  clean: true,
  tsconfigOverride: {
    compilerOptions: {
      module: "esnext"
    }
  }
}

const getBuildOptions = () => {
  const options = [...process.argv].splice(2)
  const pluginBasenames = options
    .filter((arg) => arg.startsWith("--plugin="))
    .map((arg) => arg.substring("--plugin=".length))

  const minifyOutput = options.includes("--minify")
  return { pluginBasenames, minifyOutput }
}

const getPluginSrcString = async (basename: string) => {
  const entryFile = path.join(
    PLUGINS_PARENT_PATH,
    basename,
    PLUGIN_FILE_CONVENTIONS.ENTRY_FILE
  )

  const bundle = await rollup({
    input: entryFile,
    plugins: [typescript(RollupTSPluginOptions), nodeResolve()]
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
  const tailwindConfigImport = (await import(
    pathToFileURL(PLUGINS_TAILWIND_CONFIG_PATH).href
  )) as { default: Readonly<TailwindConfig> }

  const tailwindConfig = {
    ...tailwindConfigImport.default,
    content: [{ raw: srcString }]
  }

  const pluginStyleSheet = fs.readFileSync(
    path.join(
      PLUGINS_PARENT_PATH,
      basename,
      PLUGIN_FILE_CONVENTIONS.STYLE_SHEET
    ),
    "utf-8"
  )

  let { css } = await postcss([tailwindcss(tailwindConfig)]).process(
    pluginStyleSheet
  )

  const { minifyOutput } = getBuildOptions()
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
  const { minifyOutput } = getBuildOptions()
  const outputFileExtension = minifyOutput ? ".bundle.min.js" : ".bundle.js"

  const filePathToWrite = path.join(
    PLUGINS_OUTPUT_DIR,
    `${basename}${outputFileExtension}`
  )

  await fs.promises.mkdir(PLUGINS_OUTPUT_DIR, { recursive: true })
  await fs.promises.writeFile(filePathToWrite, src)
}

const finalizePluginSrc = async (srcString: string) => {
  const { minifyOutput } = getBuildOptions()

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

const initializePluginBuildProcess = async () => {
  const { pluginBasenames } = getBuildOptions()

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

initializePluginBuildProcess()
  .then(() => {
    // eslint-disable-next-line no-console
    console.log("------------->", "Plugin Generated Successfully")
    process.exit(0)
  })
  .catch((error) => {
    logError(error)
    process.exit(1)
  })

export {}
