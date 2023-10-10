import type { DeepPartial, DeepRequired } from "@/lib/types"
import fs from "fs"
import path from "path"

const CONFIG_FILE_NAME_CONVENTION = "outerdue.config.js"

export type OuterdueConfig = DeepPartial<{
  rootDir: boolean
  command: {
    minify: boolean
    env: boolean
  }
  plugin: {
    minify: boolean
    stylesheet: {
      tailwind: boolean
      imports: boolean
    }
  }
}>

export const OUTERDUE_CONFIG_OPTIONS = (async () => {
  const possibleConfigFilePath = path.join(
    process.cwd(),
    CONFIG_FILE_NAME_CONVENTION
  )

  let configFileExists: boolean
  try {
    await fs.promises.access(possibleConfigFilePath, fs.constants.R_OK)
    configFileExists = true
  } catch {
    configFileExists = false
  }

  let definedConfig: Readonly<OuterdueConfig> = {}

  if (configFileExists) {
    const configExport = (await import(possibleConfigFilePath)) as {
      default: Readonly<OuterdueConfig>
    }

    definedConfig = configExport.default
  }

  const { rootDir, command, plugin } = definedConfig

  return {
    rootDir: rootDir ?? false,
    command: {
      minify: command?.minify ?? true,
      env: command?.env ?? true
    },
    plugin: {
      minify: plugin?.minify ?? true,
      stylesheet: {
        tailwind: plugin?.stylesheet?.tailwind ?? true,
        imports: plugin?.stylesheet?.imports ?? false
      }
    }
  } satisfies DeepRequired<OuterdueConfig>
})()

export const SHARED_CONSTANTS = (async () => {
  const { rootDir } = await OUTERDUE_CONFIG_OPTIONS
  const OUTERBASE_PATH = path.join(
    process.cwd(),
    rootDir ? "outerbase" : "src/outerbase"
  )

  const GENERATED_FILES_PATH = path.join(OUTERBASE_PATH, ".generated")
  return { OUTERBASE_PATH, GENERATED_FILES_PATH }
})()
