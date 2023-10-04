import { CommandEndpoint } from "@/outerbase/system/command"
import { KeyValidationCommand } from "./access.validate_key/base"

/**
 * An endpoint for validating keys passed to other outerbase endpoints
 */
export const KeyValidationEndpoint = new CommandEndpoint({
  command: KeyValidationCommand,
  method: "POST",
  id: "access.validate_key",
  path: "/access/validate/key"
})
