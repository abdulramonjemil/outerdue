import { JSNodeHandler } from "@/system/command"
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
    data: { key, scheme, isValid: key === schemeToKeysMap.get(scheme) }
  }
}
