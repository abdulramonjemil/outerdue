import { CommandEndpoint } from "@/system/command"
import { KeyValidationCommand } from "./access.validate_key/base"
import { TestCommand } from "./test.example/base"

/**
 * An endpoint for validating keys passed to other outerbase endpoints
 */
export const KeyValidationEndpoint = new CommandEndpoint({
  command: KeyValidationCommand,
  method: "POST",
  id: "access.validate_key",
  path: "/access/validate/key"
})

export const TestEndpoint = new CommandEndpoint({
  command: TestCommand,
  method: "GET",
  id: "test.example",
  path: "/test/command"
})
