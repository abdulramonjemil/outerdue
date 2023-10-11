import path from "path"
import fs from "fs"

import nodeResolve from "@rollup/plugin-node-resolve"
import typescript from "rollup-plugin-typescript2"

import replace from "@rollup/plugin-replace"
import virtual from "@rollup/plugin-virtual"
import terser from "@rollup/plugin-terser"
import commonjs from "@rollup/plugin-commonjs"

import * as dotenv from "dotenv"
import { rollup } from "rollup"
import { format } from "prettier"
import { rimraf } from "rimraf"
import { fileURLToPath } from "url"

import type { CommandDef, RawSQLNodeHandlerDefiner } from "@/system/command"
import { SHARED_CONSTANTS, createErrorLogger, logMajorInfo } from "@/cli/base"

import { SQLNodeProxyDefiner } from "./base/proxy"
import type * as ProxyModule from "./base/proxy"

/**
 * This export is used in this file, but not directly. It is included here so
 * that it is compiled too. We've also set `manualChunks` in rollup config so
 * that the file is not inlined.
 */
export { JSNodeProxy } from "./base/proxy"

const PATH_CONFIGS = (async () => {
  const { OUTERBASE_PATH, GENERATED_FILES_PATH } = await SHARED_CONSTANTS

  const COMMANDS_PATH = path.join(OUTERBASE_PATH, "commands")
  const COMMANDS_ENV_FILE_PATH = path.join(COMMANDS_PATH, ".env")
  const COMMANDS_OUTPUT_PATH = path.join(GENERATED_FILES_PATH, "commands")

  return {
    COMMANDS_PATH,
    COMMANDS_ENV_FILE_PATH,
    COMMANDS_OUTPUT_PATH
  }
})()

const PROXY_CONSTANTS = {
  EXPORT_ID: "JSNodeProxy" satisfies keyof typeof ProxyModule
}

const COMMAND_FILE_CONVENTIONS = {
  ENTRY_FILE: "main.ts",
  OUTPUT_JSON_CONFIG_FILE: "command.config.json"
}

const COMMAND_CODE_CONVENTIONS = {
  COMMAND_DEFINITION_EXPORT_ID: "CommandDefinition"
} as const

// Nodes have to be exported with these names from the entry
// file based on their index. So, a JS node that is the first
// node must be exported as `NODE_ONE` and so on.
const NODE_EXPORT_ID_CONVENTIONS_BY_INDEX = [
  "NODE_ONE",
  "NODE_TWO",
  "NODE_THREE",
  "NODE_FOUR",
  "NODE_FIVE",
  "NODE_SIX",
  "NODE_SEVEN",
  "NODE_EIGHT",
  "NODE_NINE",
  "NODE_TEN"
]

const NODE_INDEX_TO_TEXT_MAP = [
  "first node",
  "second node",
  "third node",
  "fourth node",
  "fifth node",
  "sixth node",
  "seventh node",
  "eighth node",
  "ninth node",
  "tenth node"
]

type EnvConfig = Record<string, string>

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

  const basenames = options
    .filter((arg) => arg.startsWith("--cmd=") || arg.startsWith("--command="))
    .map((arg) =>
      arg.substring((arg.startsWith("--cmd=") ? "--cmd=" : "--command=").length)
    )

  const minifyOutput = options.includes("--minify")

  return { commandBasenames: basenames, minifyOutput }
})()

const loadCommandsEnv = async () => {
  const { COMMANDS_ENV_FILE_PATH } = await PATH_CONFIGS

  const configOutput = dotenv.config({
    path: COMMANDS_ENV_FILE_PATH,
    processEnv: {}
  })

  if (configOutput.error) throw configOutput.error
  // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
  const parsedConfig = configOutput.parsed!
  return parsedConfig
}

const loadCommandDefinition = async (basename: string) => {
  const { COMMANDS_PATH } = await PATH_CONFIGS
  const entryFilePath = path
    .join(COMMANDS_PATH, basename, COMMAND_FILE_CONVENTIONS.ENTRY_FILE)
    .replace(/\\/g, "/")

  const { COMMAND_DEFINITION_EXPORT_ID } = COMMAND_CODE_CONVENTIONS
  const js = String.raw

  const commandDefSrc = js`
    export { ${COMMAND_DEFINITION_EXPORT_ID} } from "${entryFilePath}"
  `

  const bundle = await rollup({
    input: "__entry__",
    plugins: [
      virtual({
        __entry__: commandDefSrc
      }),
      nodeResolve(),
      commonjs(),
      typescript(RollupTSPluginOptions)
    ]
  })

  // Must be esm format in order to use it in data url for dynamic import
  const code = await bundle
    .generate({ format: "esm" })
    .then((output) => output.output[0].code)
  await bundle.close()

  const codeBase64Encoded = Buffer.from(code).toString("base64")
  const codeBase64URL = `data:text/javascript;base64,${codeBase64Encoded}`
  const commandDefinition = await import(codeBase64URL).then(
    (module) =>
      (module as { [COMMAND_DEFINITION_EXPORT_ID]: CommandDef })[
        COMMAND_DEFINITION_EXPORT_ID
      ]
  )

  return commandDefinition
}

const getJSNodeSrcString = async ({
  commandBasename,
  commandDefinition,
  envConfig,
  nodeIndex
}: {
  commandBasename: string
  commandDefinition: CommandDef
  envConfig: EnvConfig
  nodeIndex: keyof CommandDef["nodes"] & number
}) => {
  const { COMMANDS_PATH } = await PATH_CONFIGS
  const commandEntryPath = path
    .join(COMMANDS_PATH, commandBasename, COMMAND_FILE_CONVENTIONS.ENTRY_FILE)
    .replace(/\\/g, "/")

  const { EXPORT_ID: PROXY_EXPORT_ID } = PROXY_CONSTANTS

  /**
   * Although we're using dynamic import here, this file is expected to be
   * bundled with rollup so since we're already importing from it, the import
   * below will be replaced if necessary.
   */
  const commandsProxyPath = fileURLToPath(
    (await import("./base/proxy")).IMPORT_META_URL
  ).replace(/\\/g, "/")

  const nodeHandlerExportId = NODE_EXPORT_ID_CONVENTIONS_BY_INDEX[nodeIndex]
  const { COMMAND_DEFINITION_EXPORT_ID } = COMMAND_CODE_CONVENTIONS

  const PROXY_RESULT_EXPORT_ID = "__JS_NODE_FINAL_RESULT__"
  const SRC_IIFE_VAR_NAME = "__JS_NODE_FULL_HANDLER_RESULT__"

  /**
   * The paramters taken by JSNodeProxy can be seen in the definition
   */
  const js = String.raw
  const nodeCompilationInputSrc = js`
    import { ${nodeHandlerExportId}, ${COMMAND_DEFINITION_EXPORT_ID} } from "${commandEntryPath}"
    import { ${PROXY_EXPORT_ID} } from "${commandsProxyPath}"

    export const ${PROXY_RESULT_EXPORT_ID} = ${PROXY_EXPORT_ID}({
      nodeHandler: ${nodeHandlerExportId},
      nodeIndex: ${nodeIndex},
      commandDefinition: ${COMMAND_DEFINITION_EXPORT_ID}
    })
  `

  const envReplacementMap = {} as Record<string, string>
  Object.keys(envConfig).forEach((key) => {
    envReplacementMap[`process.env.${key}`] = JSON.stringify(envConfig[key])
  })

  const bundle = await rollup({
    input: "__entry__",
    plugins: [
      virtual({
        __entry__: nodeCompilationInputSrc
      }),
      replace({
        preventAssignment: true,
        values: envReplacementMap
      }),
      nodeResolve(),
      commonjs(),
      typescript(RollupTSPluginOptions)
    ]
  })

  const { minifyOutput } = BUILD_OPTIONS

  const code = await bundle
    .generate({
      format: "iife",
      name: SRC_IIFE_VAR_NAME,
      plugins: [...(minifyOutput ? [terser()] : [])]
    })
    .then((output) => output.output[0].code)
  await bundle.close()

  const nodeConfig = commandDefinition.nodes[nodeIndex]
  const isAsync = nodeConfig.type === "js" && nodeConfig.isAsync

  const codeWithOuterbaseConvention = js`
    /**
     * Node parent command: '${commandDefinition.name}'
     * Node name: '${commandDefinition.nodes[nodeIndex].name}'
     * Node index: ${nodeIndex} -- ${NODE_INDEX_TO_TEXT_MAP[nodeIndex]}
     */

    ${isAsync ? "async " : ""}function userCode() {
      ${code}

      return ${SRC_IIFE_VAR_NAME}.${PROXY_RESULT_EXPORT_ID}
    }
  `

  if (minifyOutput) return codeWithOuterbaseConvention

  const prettifiedSource = await format(codeWithOuterbaseConvention, {
    parser: "babel"
  })
  return prettifiedSource
}

// Replace all spaces with a hyphen
const nodeNameToResultAccessorName = (name: string) =>
  name.toLowerCase().replace(/ /g, "-")

const getNodeFileName = (commandDefinition: CommandDef, nodeIndex: number) => {
  const filenamePrefix = `node-${nodeIndex + 1}`
  const { name, type } = commandDefinition.nodes[nodeIndex]
  const nodeNamePart = nodeNameToResultAccessorName(name)

  const { minifyOutput } = BUILD_OPTIONS
  const filename = `${filenamePrefix}.${nodeNamePart}.${
    minifyOutput && type === "js" ? "min.js" : type
  }`

  return filename
}

const writeNodeToFile = async ({
  commandBasename,
  commandDefinition,
  nodeIndex,
  srcString
}: {
  commandBasename: string
  commandDefinition: CommandDef
  nodeIndex: number
  srcString: string
}) => {
  const { COMMANDS_OUTPUT_PATH } = await PATH_CONFIGS
  const filename = getNodeFileName(commandDefinition, nodeIndex)

  const outputDir = path.join(COMMANDS_OUTPUT_PATH, commandBasename)
  const filePathToWrite = path.join(outputDir, filename)

  await fs.promises.mkdir(outputDir, { recursive: true })
  await fs.promises.writeFile(filePathToWrite, srcString)
}

const getSQLNodeSrcString = async ({
  commandBasename,
  commandDefinition,
  nodeIndex
}: {
  commandBasename: string
  commandDefinition: CommandDef
  nodeIndex: number
}) => {
  const { COMMANDS_PATH } = await PATH_CONFIGS
  const commandEntryPath = path
    .join(COMMANDS_PATH, commandBasename, COMMAND_FILE_CONVENTIONS.ENTRY_FILE)
    .replace(/\\/g, "/")

  const nodeHandlerDefinerExportId =
    NODE_EXPORT_ID_CONVENTIONS_BY_INDEX[nodeIndex]
  const HANDLER_DEFINER_CUSTOM_EXPORT_ID = "__Custom_Node_Handler__"

  const js = String.raw
  const nodeCompilationInputSrc = js`
    export {
      ${nodeHandlerDefinerExportId} as ${HANDLER_DEFINER_CUSTOM_EXPORT_ID}
    } from "${commandEntryPath}"
  `

  const bundle = await rollup({
    input: "__entry__",
    plugins: [
      virtual({
        __entry__: nodeCompilationInputSrc
      }),
      nodeResolve(),
      commonjs(),
      typescript(RollupTSPluginOptions)
    ]
  })

  const code = await bundle
    .generate({ format: "esm" })
    .then((output) => output.output[0].code)
  await bundle.close()

  const codeBase64Encoded = Buffer.from(code).toString("base64")
  const codeBase64URL = `data:text/javascript;base64,${codeBase64Encoded}`

  // Both the proxy and the defined custom handler are expected to be functions
  // that return SQL strings
  const exports = await import(codeBase64URL).then(
    (module) =>
      module as {
        [HANDLER_DEFINER_CUSTOM_EXPORT_ID]: RawSQLNodeHandlerDefiner
      }
  )

  const JSONSource =
    nodeIndex === 0
      ? null
      : (`{{${nodeNameToResultAccessorName(
          commandDefinition.nodes[nodeIndex - 1].name
        )}}}` as const)

  /**
   * This name is what the SQL node handler function should be named. For now,
   * this name is expected to be prefixed with `pg_temp.` in the resulting query.
   */
  const handlerFunctionName = ((commandId: string, nodeName: string) => {
    // Replace every dot, hyphen and space with underscores
    // and remove any non-word characters.
    const commandIdPrefix = commandId
      .trim()
      .toLowerCase()
      .replace(/(\.| |-)/g, "_")
      .replace(/[^\w]/g, "")

    const nodeNamePrefix = nodeName
      .trim()
      .toLowerCase()
      .replace(/(\.| |-)/g, "_")
      .replace(/[^\w]/g, "")

    return `${commandIdPrefix}__${nodeNamePrefix}`
  })(commandDefinition.id, commandDefinition.nodes[nodeIndex].name)

  const sql = String.raw
  // Call the two sql string returning functions to build full node handler
  // and return the value.
  const fullNodeHandler = sql`
-- Node parent command: '${commandDefinition.name}'
-- Node name: '${commandDefinition.nodes[nodeIndex].name}'
-- Node index: ${nodeIndex} -- ${NODE_INDEX_TO_TEXT_MAP[nodeIndex]}

    ${exports[HANDLER_DEFINER_CUSTOM_EXPORT_ID]({
      HANDLER_FUNCTION_NAME: handlerFunctionName
    }).trimEnd()}

    -------------------
    -- |   PROXY   | --
    -------------------
    ${SQLNodeProxyDefiner({
      JSON_SOURCE: JSONSource,
      HANDLER_FUNCTION_NAME: handlerFunctionName,
      PREFIXER: `p_${handlerFunctionName}`
    }).trimEnd()}
  `

  return `${fullNodeHandler.trim()}\n`
}

const writeNodeConfigToFile = async (
  commandBasename: string,
  commandDefinition: CommandDef
) => {
  const { COMMANDS_OUTPUT_PATH } = await PATH_CONFIGS
  const { OUTPUT_JSON_CONFIG_FILE } = COMMAND_FILE_CONVENTIONS
  const outputDir = path.join(COMMANDS_OUTPUT_PATH, commandBasename)
  const outputFile = path.join(outputDir, OUTPUT_JSON_CONFIG_FILE)
  const content = {
    name: commandDefinition.name,
    method: commandDefinition.method,
    namespace: commandDefinition.namespace,
    path: commandDefinition.path,
    id: commandDefinition.id,
    nodes: commandDefinition.nodes.map((node, index) => ({
      type: node.type,
      name: node.name,
      file: getNodeFileName(commandDefinition, index)
    }))
  }

  await fs.promises.mkdir(outputDir, { recursive: true })
  await fs.promises.writeFile(
    outputFile,
    `${JSON.stringify(content, null, 2)}\n`
  )
}

const buildCommand = async (basename: string, envConfig: EnvConfig) => {
  const commandDefinition = await loadCommandDefinition(basename)
  // eslint-disable-next-line no-console
  console.log("Building command:", basename)

  if (commandDefinition.id !== basename)
    throw new Error(
      `A command's basename should be the same as its ID.\nGotten ID: ${commandDefinition.id}, directory: ${basename}. Change 'CommandDefinition.id' or rename the directory.`
    )

  const nodeSrcStrings = await Promise.all(
    commandDefinition.nodes.map(async (node, index) => {
      const params = {
        commandBasename: basename,
        commandDefinition,
        envConfig,
        nodeIndex: index
      }

      if (node.type === "js") {
        const nodeSrcString = await getJSNodeSrcString(params)
        return nodeSrcString
      }

      const nodeSrcString = await getSQLNodeSrcString(params)
      return nodeSrcString
    })
  )

  const { COMMANDS_OUTPUT_PATH } = await PATH_CONFIGS
  const outputDir = path.join(COMMANDS_OUTPUT_PATH, basename)
  await rimraf(outputDir)

  await Promise.all([
    ...nodeSrcStrings.map((src, index) =>
      writeNodeToFile({
        commandBasename: basename,
        commandDefinition,
        nodeIndex: index,
        srcString: src
      })
    ),
    writeNodeConfigToFile(basename, commandDefinition)
  ])
}

const RunOuterdueCommandBuildProcess = async () => {
  const commandEnv = await loadCommandsEnv()
  const buildOptions = BUILD_OPTIONS
  const { commandBasenames } = buildOptions

  if (commandBasenames.length === 0) {
    throw new Error(
      [
        "No commands to process",
        "You might be using the wrong syntax.",
        "The syntax is `--cmd=image-grid` or `--command=image-grid` (to process a command in the `image-grid` folder)",
        "Remember to use `--` as in `-- --cmd=image-grid` if using an npm script",
        "You may also need to pass multiple `--` if calling this script from nested npm script"
      ].join("\n")
    )
  }

  await Promise.all(
    commandBasenames.map((basename) => buildCommand(basename, commandEnv))
  )
}

// eslint-disable-next-line @typescript-eslint/naming-convention
export const OUTERDUE_COMMAND_BUILD__CMD_RUNNER = async () => {
  try {
    await RunOuterdueCommandBuildProcess()
    logMajorInfo("Command Build Process Successful")
    process.exit(0)
  } catch (error) {
    createErrorLogger("Command Build Error")(error)
    process.exit(1)
  }
}
