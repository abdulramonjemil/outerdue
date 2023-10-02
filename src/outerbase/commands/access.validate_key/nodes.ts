import { JSNodeHandler } from "@/outerbase/system/command/server"
import { OUTERBASE_CMD_SERVICE_KEY } from "@/outerbase/commands/env"
import { KeyValidationCommand, type KeyValidationPayload } from "./base"

export const NODE_ONE: JSNodeHandler<typeof KeyValidationCommand, 0> = ({
  payload
}) => {
  const { key, scheme } = payload

  const schemeToKeysMap = new Map<KeyValidationPayload["scheme"], string>([
    ["SERVICE_KEY", OUTERBASE_CMD_SERVICE_KEY]
  ])

  return {
    __cmd_type__: "js_node_success_result",
    data: { key, scheme, isValid: key === schemeToKeysMap.get(scheme) }
  }
}
