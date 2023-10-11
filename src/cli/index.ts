#!/usr/bin/env node

import { createErrorLogger, getPassedSubcommand } from "./base"

const OUTERDUE_COMMAND_CLI_INPUT = "outerdue"

const OUTERDUE_COMMAND_SUBCOMMANDS = {
  COMMAND: "command",
  PLUGIN: "plugin"
} as const

// eslint-disable-next-line @typescript-eslint/naming-convention
const OUTERDUE__CMD_RUNNER = async () => {
  const subcommand = getPassedSubcommand(OUTERDUE_COMMAND_CLI_INPUT)
  if (subcommand === null)
    throw new Error(`Expected subcommand for '${OUTERDUE_COMMAND_CLI_INPUT}'`)

  if (subcommand === OUTERDUE_COMMAND_SUBCOMMANDS.COMMAND) {
    const imported = await import("./command")
    await imported.OUTERDUE_COMMAND__CMD_RUNNER()
  } else if (subcommand === OUTERDUE_COMMAND_SUBCOMMANDS.PLUGIN) {
    const imported = await import("./plugin")
    await imported.OUTERDUE_PLUGIN__CMD_RUNNER()
  } else {
    throw new Error(`Unknown subcommand: '${subcommand}'`)
  }
}

// eslint-disable-next-line no-void
void (async () => {
  try {
    await OUTERDUE__CMD_RUNNER()
  } catch (error) {
    createErrorLogger("Error running Outerdue CLI")(error)
  }
})()

export {}
