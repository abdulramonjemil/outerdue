import { getPassedSubcommand } from "@/cli/base"

const PLUGIN_COMMAND_CLI_INPUT = "outerdue plugin"
const PLUGIN_COMMAND_SUBCOMMANDS = {
  BUILD: "build"
} as const

// eslint-disable-next-line @typescript-eslint/naming-convention
export const OUTERDUE_PLUGIN__CMD_RUNNER = async () => {
  const subcommand = getPassedSubcommand(PLUGIN_COMMAND_CLI_INPUT)
  if (subcommand === null)
    throw new Error(`Expected subcommand for '${PLUGIN_COMMAND_CLI_INPUT}'`)

  if (subcommand === PLUGIN_COMMAND_SUBCOMMANDS.BUILD) {
    const imported = await import("./build")
    await imported.OUTERDUE_PLUGIN_BUILD__CMD_RUNNER()
  } else {
    throw new Error(`Unknown subcommand: '${subcommand}'`)
  }
}
