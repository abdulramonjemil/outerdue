import {
  JSNodeHandlerSuccessResult,
  defineCommand
} from "@/outerbase/controller/command/shared"
import { ProfientaCommandsInterface } from "@/outerbase/commands/shared"
import { $$type } from "@/lib/types"

/**
 * This is meant to be a union of strings. The following explains the available
 * validation schemes.
 * - SERVICE_KEY: key that's used to authenticate the server.
 */
const VALIDATION_SCHEMES = ["SERVICE_KEY"] as const
type KeyValidationScheme = (typeof VALIDATION_SCHEMES)[number]

// eslint-disable-next-line @typescript-eslint/consistent-type-definitions
export type KeyValidationPayload = {
  key: string
  scheme: KeyValidationScheme
}

type KeyValidationResult = KeyValidationPayload & { isValid: boolean }

const isValidKeyValidationPayload = (
  value: unknown
): value is KeyValidationPayload => {
  if (typeof value !== "object") return false
  const val = value as KeyValidationPayload
  const keyIsOfRightType = typeof val.key === "string" && val.key.length > 0
  const schemeIsOfRightType = VALIDATION_SCHEMES.includes(val.scheme)
  return keyIsOfRightType && schemeIsOfRightType
}

export const KeyValidationCommand = defineCommand({
  interface: ProfientaCommandsInterface,
  method: "POST",
  namespace: "access",
  name: "Validate Access Key",
  headers: null,
  id: "access.validate_key",
  path: "/access/validate/key",
  problems: [],
  payloadValidator: isValidKeyValidationPayload,
  nodes: [
    {
      type: "js",
      name: "Validate Key",
      resultType: $$type<JSNodeHandlerSuccessResult<KeyValidationResult>>()
    }
  ]
})
