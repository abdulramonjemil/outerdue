import { getPassedSubcommand } from "@/cli/base"

const COMMAND_COMMAND_CLI_INPUT = "outerdue command"
const COMMAND_COMMAND_SUBCOMMANDS = {
  BUILD: "build"
} as const

// eslint-disable-next-line @typescript-eslint/naming-convention
export const OUTERDUE_COMMAND__CMD_RUNNER = async () => {
  const subcommand = getPassedSubcommand(COMMAND_COMMAND_CLI_INPUT)
  if (subcommand === null)
    throw new Error(`Expected subcommand for '${COMMAND_COMMAND_CLI_INPUT}'`)

  if (subcommand === COMMAND_COMMAND_SUBCOMMANDS.BUILD) {
    const imported = await import("./build")
    await imported.OUTERDUE_COMMAND_BUILD__CMD_RUNNER()
  } else {
    throw new Error(`Unknown subcommand: '${subcommand}'`)
  }
}
