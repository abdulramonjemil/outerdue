import { KeyValidationEndpoint } from "@/outerbase/commands/client"

type KeyValidationScheme = Parameters<
  typeof KeyValidationEndpoint.fetch
>[0]["body"]["scheme"]

export async function validateKey<
  InvalidKeyErrorCode extends string = "INVALID_API_KEY",
  RequestIssueErrorCode extends string = "KEY_VALIDATION_ERROR"
>({
  key,
  scheme,
  onInvalidKey = "INVALID_API_KEY" as InvalidKeyErrorCode,
  onRequestError = "KEY_VALIDATION_ERROR" as RequestIssueErrorCode
}: {
  key: string
  scheme: KeyValidationScheme
  onInvalidKey: InvalidKeyErrorCode
  onRequestError: RequestIssueErrorCode
}): Promise<
  | { status: "success" }
  | {
      status: "failed"
      error: {
        code: InvalidKeyErrorCode
        message: string
      }
    }
  | {
      status: "error"
      error: {
        code: RequestIssueErrorCode
        message: string
      }
    }
> {
  const errorResult = {
    status: "error",
    error: {
      code: onRequestError,
      message: "Could not validate your API key. Please try again."
    }
  } as const

  try {
    const keyValidationResult = await KeyValidationEndpoint.fetch({
      body: { key, scheme }
    })

    if (!keyValidationResult.payload.error) {
      if (keyValidationResult.payload.data.isValid) return { status: "success" }
      return {
        status: "failed",
        error: {
          code: onInvalidKey,
          message:
            "The provided API key is invalid. Please check your API key and try again."
        }
      }
    }

    return errorResult
  } catch {
    return errorResult
  }
}
