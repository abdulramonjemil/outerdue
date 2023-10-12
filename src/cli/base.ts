import type { DeepPartial, DeepRequired } from "@/lib/types"
import fs from "fs"
import path from "path"

const CONFIG_FILE_NAME_CONVENTION = "outerdue.config.js"
const CLI_STANDALONE_COMMAND_REGEX = /^[a-z]+(-[a-z]+)*$/

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
    }
  }
}>

// eslint-disable-next-line no-underscore-dangle, @typescript-eslint/naming-convention
const __getOuterdueConfigOptions = async () => {
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
        tailwind: plugin?.stylesheet?.tailwind ?? true
      }
    }
  } satisfies DeepRequired<OuterdueConfig>
}

const OUTERDUE_CONFIG_OPTIONS: {
  value: Awaited<ReturnType<typeof __getOuterdueConfigOptions>> | null
} = { value: null }

export const getOuterdueConfigOptions = async () => {
  if (!OUTERDUE_CONFIG_OPTIONS.value)
    OUTERDUE_CONFIG_OPTIONS.value = await __getOuterdueConfigOptions()
  return OUTERDUE_CONFIG_OPTIONS.value
}

// eslint-disable-next-line no-underscore-dangle, @typescript-eslint/naming-convention
const __getSharedConstants = async () => {
  const { rootDir } = await getOuterdueConfigOptions()
  const OUTERBASE_PATH = path.join(
    process.cwd(),
    rootDir ? "outerbase" : "src/outerbase"
  )

  const GENERATED_FILES_PATH = path.join(OUTERBASE_PATH, ".generated")
  return { OUTERBASE_PATH, GENERATED_FILES_PATH }
}

const SHARED_CONSTANTS: {
  value: Awaited<ReturnType<typeof __getSharedConstants>> | null
} = { value: null }

export const getSharedConstants = async () => {
  if (!SHARED_CONSTANTS.value)
    SHARED_CONSTANTS.value = await __getSharedConstants()
  return SHARED_CONSTANTS.value
}

type CLIOptionTypeMap = {
  boolean: boolean
  array: string[]
  string: string
}

type CLINamedOptionConfig = {
  type: keyof CLIOptionTypeMap
  required: boolean
  short?: string
}

type CLIOptionsValues<
  OptionsConfig extends Record<string, CLINamedOptionConfig>
> = {
  [K in keyof OptionsConfig]:
    | CLIOptionTypeMap[OptionsConfig[K]["type"]]
    | (OptionsConfig[K]["required"] extends true ? never : undefined)
}

const isSetterCLIOption = (option: string) => option.startsWith("-")
/** `@` is used to escape strings i.e force it to not be treated as a setter */
const getCLIOptionAsNonSetterString = (option: string) =>
  option.startsWith("@") ? option.substring(1) : option

/** `command` is expected to be be command to be run from the CLI */
const getCommandCLIArgsArgvOffset = (command: string) => {
  // The first two values in `process.argv` are metadata
  const ARGV_PROCESS_METADATA_LENGTH = 2

  /**
   * Passing something like `outerdue plugin` will return `3`. So, for example,
   * when the command `outerdue plugin -y` is entered in CLI, `process.argv`
   * will be is `[exec_path, file_path, 'plugin', '-y']`. An offset of `3` will
   * then give the start of the command's arguments.
   */
  return command.split(/ +/).length + ARGV_PROCESS_METADATA_LENGTH - 1
}

const getCommandCLINamedOptionsArgvOffset = (command: string) => {
  const commandArgsArgvOffset = getCommandCLIArgsArgvOffset(command)

  const firstSetterOptionIndex = process.argv
    .slice(commandArgsArgvOffset)
    .findIndex((option) => isSetterCLIOption(option))

  if (firstSetterOptionIndex === -1) return process.argv.length
  return firstSetterOptionIndex + commandArgsArgvOffset
}

export const getCommandCLIUnnamedOptions = (command: string) => {
  const startIndex = getCommandCLIArgsArgvOffset(command)
  const endIndex = getCommandCLINamedOptionsArgvOffset(command)
  return process.argv
    .slice(startIndex, endIndex)
    .map((option) => getCLIOptionAsNonSetterString(option))
}

const getCommandRawCLIArgs = (command: string) =>
  process.argv.slice(getCommandCLIArgsArgvOffset(command))

export const getPassedSubcommand = (command: string) => {
  const potentialSubcommad = getCommandRawCLIArgs(command)[0]
  if (
    !potentialSubcommad ||
    isSetterCLIOption(potentialSubcommad) ||
    !CLI_STANDALONE_COMMAND_REGEX.test(potentialSubcommad)
  ) {
    return null
  }
  return potentialSubcommad
}

export type CommandCLINamedOptionsConfig = Record<string, CLINamedOptionConfig>

export const defineCommandCLINamedOptions = <
  OptionsConfig extends CommandCLINamedOptionsConfig
>(
  config: OptionsConfig
) => config

export const parseCommandCLINamedOptions = <
  OptionsConfig extends CommandCLINamedOptionsConfig
>({
  command,
  noUnnamedOptions,
  options
}: {
  /**
   * The amount of items to be removed from the start of `process.argv` before
   * parsing options.
   */
  command: string
  noUnnamedOptions: boolean
  options: OptionsConfig
}): CLIOptionsValues<OptionsConfig> => {
  const entries = Object.entries(options)
  const setterNameToDataMap = entries.map(
    ([optionName, config]) =>
      [`--${optionName}`, { name: optionName, ...config }] as const
  )

  const shortSetterToDataMap = entries
    .filter(
      (entry): entry is [string, (typeof entry)[1] & { short: string }] =>
        typeof entry[1].short === "string"
    )
    .map(
      ([optionName, config]) =>
        [`-${config.short}`, { name: optionName, ...config }] as const
    )

  const setterToDataMap = new Map([
    ...setterNameToDataMap,
    ...shortSetterToDataMap
  ])

  const getOptionData = (option: string) => {
    if (isSetterCLIOption(option)) {
      return {
        isSetter: true as const,
        config: setterToDataMap.get(option as `-${string}`) ?? null
      }
    }

    return {
      isSetter: false as const,
      value: getCLIOptionAsNonSetterString(option)
    }
  }

  const offset = noUnnamedOptions
    ? getCommandCLIArgsArgvOffset(command)
    : getCommandCLINamedOptionsArgvOffset(command)
  const args = process.argv.slice(offset)
  const cliOptions: Record<
    string,
    CLIOptionTypeMap[keyof CLIOptionTypeMap] | undefined
  > = {}

  let lastSetterData: {
    name: string
    type: keyof CLIOptionTypeMap
  } | null = null

  args.forEach((arg, index) => {
    const data = getOptionData(arg)

    if (data.isSetter) {
      if (!data.config) throw new Error(`Unknown option: '${arg}'`)
      if (data.config.type === "boolean") cliOptions[data.config.name] = true
      else if (index === args.length - 1)
        throw new Error(`Expected value for option ${arg}`)

      lastSetterData = { name: data.config.name, type: data.config.type }
    } else if (lastSetterData) {
      const { name: setterName, type: setterType } = lastSetterData
      const prevValue = cliOptions[setterName]

      if (setterType === "array") {
        cliOptions[setterName] = Array.isArray(prevValue)
          ? [...prevValue, data.value]
          : [data.value]
      } else if (setterType === "string") {
        cliOptions[setterName] = data.value
      } else {
        if (data.value !== "true" && data.value !== "false")
          throw new Error(`Invalid value for option: '${setterName}'`)
        cliOptions[setterName] = data.value === "true"
      }
    } else {
      throw new Error(`Invalid option '${arg}'`)
    }
  })

  entries.forEach(([name, { required }]) => {
    if (!(name in cliOptions)) {
      if (required) throw new Error(`Missing option '${name}'`)
      cliOptions[name] = undefined
    }
  })

  return cliOptions as CLIOptionsValues<OptionsConfig>
}

export const logMajorInfo = (info: string) => {
  // eslint-disable-next-line no-console
  console.log("------------->", info)
}

export const createErrorLogger =
  (info: string) =>
  (...message: unknown[]) => {
    // eslint-disable-next-line no-console
    console.error(
      `---> Outerdue: ${info}:`,
      "\n\n",
      "Plain error:",
      ...message,
      "\n\n",
      "Error as string:",
      ...message.map((val) => String(val))
    )
  }
