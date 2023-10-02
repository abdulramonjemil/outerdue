import fs from "fs"
import path from "path"
import postcss from "postcss"

import tailwindcss, { type Config as TailwindConfig } from "tailwindcss"
import { rollup } from "rollup"
import { pathToFileURL } from "url"

// import typescript from "@rollup/plugin-typescript"
import typescript from "rollup-plugin-typescript2"
import nodeResolve from "@rollup/plugin-node-resolve"
import { format } from "prettier"
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
  console.error("---> Outerbase Plugin Generator Error:", ...message)
}

const getBuildOptions = () => {
  const options = [...process.argv].splice(2)
  const pluginBasenames = options
    .filter((arg) => arg.startsWith("--plugin="))
    .map((arg) => arg.substring("--plugin=".length))

  return { pluginBasenames }
}

const getPluginSrcString = async (basename: string) => {
  const entryFile = path.join(
    PLUGINS_PARENT_PATH,
    basename,
    PLUGIN_FILE_CONVENTIONS.ENTRY_FILE
  )

  const bundle = await rollup({
    input: entryFile,
    plugins: [typescript({ check: false }), nodeResolve()]
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

  return (
    await postcss([tailwindcss(tailwindConfig)]).process(pluginStyleSheet)
  ).css
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
  const PLUGIN_OUTPUT_FILE_EXTENSION = ".bundle.js"

  const prettifiedSource = await format(src, { parser: "babel" })
  const filePathToWrite = path.join(
    PLUGINS_OUTPUT_DIR,
    `${basename}${PLUGIN_OUTPUT_FILE_EXTENSION}`
  )

  return new Promise((resolve, reject) => {
    fs.writeFile(filePathToWrite, prettifiedSource, (error) => {
      if (error) reject(error)
      else resolve(undefined)
    })
  })
}

const buildPlugin = async (basename: string) => {
  // eslint-disable-next-line no-console
  console.log("Building plugin:", basename)
  const srcString = await getPluginSrcString(basename)
  const styleSheet = await getPluginStyles(basename, srcString)

  const srcWithStyleSheet = insertOutputStyleSheet(srcString, styleSheet)
  await writePluginToFile(basename, srcWithStyleSheet)
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
