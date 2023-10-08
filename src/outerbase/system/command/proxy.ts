import { tryJSONParse } from "@/lib/parse"
import type { GuardedType, JSONValue } from "@/lib/types"

import { type CommandEndpointResult } from "./client"
import {
  NodeProblemCode,
  tryCommandResultJSONParse,
  CommandDef,
  SQLNodeProblemResult,
  JSNodeExitResult,
  SQLNodeExitResult,
  JSNodeConfig,
  JSNodeProblemResult,
  JSNodeResult
} from "./shared"

import { JSNodeHandlerReturn } from "./server"

/**
 * These values are what outerbase compiles the {{request.*}} syntax and its
 * like to.
 */
declare const requestParams: {
  inputs: {
    // Always a string but can be an empty string
    "request.body": string

    // Query params are always strings if present
    [queryParam: `request.query.${string}`]: string | undefined

    // Headers passed with the request and those added by Outerbase
    [header: `request.header.${string}`]: string | undefined

    // Other items of this object can be any valid JSON value if present
    [str: string]: JSONValue | undefined
  }
}

function getParamValidationInfo(commandDefinition: CommandDef):
  | { status: "error"; paramType: "query" | "body" }
  | {
      status: "success"
      paramValue: GuardedType<(typeof commandDefinition)["payloadValidator"]>
    } {
  if (commandDefinition.queryParams) {
    // Param keys are stored in an object (the values don't matter much though)
    const paramKeys = Object.keys(commandDefinition.queryParams)
    const paramsObject: Record<string, unknown> = {}

    paramKeys.forEach((key) => {
      const paramValue = requestParams.inputs[`request.query.${key}`]
      paramsObject[key] = paramValue
    })

    const validationFailed = !commandDefinition.payloadValidator.call(
      null,
      paramsObject
    )

    if (validationFailed) {
      return { status: "error", paramType: "query" }
    }

    return {
      status: "success",
      paramValue: paramsObject as GuardedType<
        (typeof commandDefinition)["payloadValidator"]
      >
    }
  }

  const body = requestParams.inputs["request.body"]
  const jsonParseResult = tryJSONParse(body)

  const validationFailed =
    !jsonParseResult.success ||
    !commandDefinition.payloadValidator.call(null, jsonParseResult.value)

  if (validationFailed) {
    return { status: "error", paramType: "body" }
  }

  return {
    status: "success",
    paramValue: jsonParseResult.value as GuardedType<
      (typeof commandDefinition)["payloadValidator"]
    >
  }
}

const nodeNameToIndexer = (nodeName: string) =>
  nodeName.toLowerCase().replace(/ /g, "-")

const getFullProblemResult = (
  code: NodeProblemCode,
  message: string
): JSNodeProblemResult => ({
  source: "js",
  payload: {
    error: { code, message },
    __type__: "problem_result"
  }
})

function getPrevNodeResultsData(
  commandDefinition: CommandDef,
  nodeIndex: number
):
  | { success: false; faultyNodesNames: string[] }
  | { success: true; results: CommandEndpointResult[] } {
  const $$INVALID_RESULT = Symbol("$$INVALID_RESULT")
  const faultyNodesNames: string[] = []

  const prevResults = commandDefinition.nodes
    // A node has access to results from earlier nodes. For example, a node at
    // index 3 has access to results from the first and second nodes
    .slice(0, nodeIndex)
    .map((node) => requestParams.inputs[nodeNameToIndexer(node.name)])
    .map((resultValue, index) => {
      if (typeof resultValue !== "string") {
        faultyNodesNames.push(commandDefinition.nodes[index].name)
        return $$INVALID_RESULT
      }

      // Try to parse the result as JSON. Leave it as is if not parsable.
      const parseResult = tryCommandResultJSONParse(resultValue)
      if (!parseResult.success) {
        faultyNodesNames.push(commandDefinition.nodes[index].name)
        return $$INVALID_RESULT
      }

      return parseResult.value as CommandEndpointResult
    })

  if (faultyNodesNames.length > 0) {
    return { success: false, faultyNodesNames }
  }

  return {
    success: true,
    results: prevResults as Exclude<
      (typeof prevResults)[number],
      typeof $$INVALID_RESULT
    >[]
  }
}

const getHeadersValidationInfo = (
  commandDefinition: CommandDef
):
  | { success: true; empty: true }
  | { success: true; empty: false; values: Record<string, string | undefined> }
  | { success: false; missing: string[] } => {
  const { headers } = commandDefinition
  if (!headers) return { success: true, empty: true }

  const headerNames = Object.keys(headers)
  const headersObject: Record<string, string | undefined> = {}
  const missingRequiredHeaders: string[] = []

  headerNames.forEach((name) => {
    const headerValue =
      requestParams.inputs[`request.header.${name.toLowerCase()}`]
    headersObject[name] = headerValue

    // eslint-disable-next-line @typescript-eslint/no-unnecessary-boolean-literal-compare
    const headerIsRequired = headers[name] === true
    if (headerIsRequired && headerValue === undefined)
      missingRequiredHeaders.push(name)
  })

  if (missingRequiredHeaders.length !== 0) {
    return { success: false, missing: missingRequiredHeaders }
  }

  return { success: true, empty: false, values: headersObject }
}

/* eslint-disable @typescript-eslint/no-unnecessary-condition, no-underscore-dangle */
const isJSNodeProblemResult = (
  value: unknown
): value is JSNodeProblemResult => {
  const val = value as JSNodeProblemResult
  return val?.source === "js" && val?.payload?.__type__ === "problem_result"
}

const isSQLNodeProblemResult = (
  value: unknown
): value is SQLNodeProblemResult => {
  const val = value as SQLNodeProblemResult
  return (
    typeof val?.success === "boolean" &&
    val?.response?.items?.[0]?.__type__ === "problem_result"
  )
}

type CommandDefWithDefinedOrExitResult = Omit<CommandDef, "nodes"> & {
  nodes: [JSNodeConfig]
  exitCodes: [string]
}

type CommandDefWithAsyncDefinedOrExitResult = Omit<CommandDef, "nodes"> & {
  nodes: [JSNodeConfig & { isAsync: true }]
  exitCodes: [string]
}

const isJSNodeExitResult = (
  value: unknown
): value is JSNodeExitResult<CommandDefWithDefinedOrExitResult> => {
  const val = value as JSNodeExitResult<CommandDefWithDefinedOrExitResult>
  return val?.source === "js" && val?.payload?.__type__ === "exit_result"
}

const isSQLNodeExitResult = (
  value: unknown
): value is SQLNodeExitResult<CommandDefWithDefinedOrExitResult> => {
  const val = value as SQLNodeExitResult<CommandDefWithDefinedOrExitResult>
  return (
    typeof val?.success === "boolean" &&
    val?.response?.items?.[0]?.__type__ === "exit_result"
  )
}
/* eslint-enable @typescript-eslint/no-unnecessary-condition, no-underscore-dangle */

type HandlerReturn =
  | JSNodeHandlerReturn<CommandDefWithDefinedOrExitResult, 0>
  | JSNodeHandlerReturn<CommandDefWithAsyncDefinedOrExitResult, 0>

type ProxyReturn =
  | JSNodeProblemResult
  | JSNodeResult<JSNodeHandlerReturn<CommandDefWithDefinedOrExitResult, 0>>
  | Promise<
      JSNodeResult<
        Awaited<JSNodeHandlerReturn<CommandDefWithAsyncDefinedOrExitResult, 0>>
      >
    >

export function JSNodeProxy({
  nodeHandler,
  nodeIndex,
  commandDefinition
}: {
  nodeHandler: (...args: unknown[]) => HandlerReturn
  nodeIndex: number
  commandDefinition: CommandDef
}): ProxyReturn {
  const paramValidationInfo = getParamValidationInfo(commandDefinition)

  if (paramValidationInfo.status === "error") {
    return getFullProblemResult(
      "INVALID_BODY_OR_QUERY",
      `The request '${paramValidationInfo.paramType}' does not match the specified type`
    )
  }

  const headersValidationInfo = getHeadersValidationInfo(commandDefinition)

  if (!headersValidationInfo.success) {
    return getFullProblemResult(
      "MISSING_REQUIRED_HEADERS",
      `The following headers are missing: ${headersValidationInfo.missing.join(
        ", "
      )}`
    )
  }

  const prevNodeResultsData = getPrevNodeResultsData(
    commandDefinition,
    nodeIndex
  )

  if (!prevNodeResultsData.success) {
    return getFullProblemResult(
      "INTERNAL_PARSING_ERROR",
      `Could not determine the result of nodes '${prevNodeResultsData.faultyNodesNames.join(
        ", "
      )}' inside node '${
        commandDefinition.nodes[nodeIndex].name
      }' at index ${nodeIndex}`
    )
  }

  if (prevNodeResultsData.results.length > 0) {
    const lastResult =
      prevNodeResultsData.results[prevNodeResultsData.results.length - 1]

    if (isJSNodeProblemResult(lastResult)) {
      return getFullProblemResult(
        lastResult.payload.error.code,
        lastResult.payload.error.message
      )
    }

    if (isSQLNodeProblemResult(lastResult)) {
      return getFullProblemResult(
        lastResult.response.items[0].error.code,
        lastResult.response.items[0].error.message
      )
    }

    /**
     * If a problem result is detected, don't call the handler, just return the
     * result. It is expected that the next node's proxy would do the same.
     */
    if (isJSNodeExitResult(lastResult)) return lastResult
    if (isSQLNodeExitResult(lastResult)) {
      // Normalize the wrapped result
      return {
        source: "js",
        payload: {
          __type__: "exit_result",
          info: {
            code: lastResult.response.items[0].info.code,
            message: lastResult.response.items[0].info.message
          }
        }
      }
    }
  }

  // See the schema for command nodes for parameter types
  const result = nodeHandler.apply(null, [
    {
      payload: paramValidationInfo.paramValue,
      headers: headersValidationInfo.empty ? null : headersValidationInfo.values
    },
    ...prevNodeResultsData.results
  ])

  if (result instanceof Promise) {
    return result.then((value) => ({ source: "js", payload: value }))
  }

  return { source: "js", payload: result }
}

const sql = String.raw

/**
 * This is the proxy for all SQL nodes. It currently does just one thing:
 * - If the preceding JS node result was from the proxy and not the handler,
 *   then some error occurred, therefore, this returns a custom result (based on
 *   the result from that last node) and will not call the SQL node handler
 *   in such case.
 */
export const SQLNodeProxyDefiner = ({
  JSON_SOURCE,
  HANDLER_FUNCTION_NAME,
  PREFIXER
}: {
  JSON_SOURCE: `{{${string}}}` | null
  HANDLER_FUNCTION_NAME: string
  PREFIXER: string
}) => sql`
CREATE OR REPLACE FUNCTION pg_temp.${PREFIXER}__handle_cmd_node(prev_node_result jsonb)
RETURNS boolean AS $$ -- Returned boolean so SELECT ... INTO works
BEGIN
  DROP TABLE IF EXISTS __cmd_current_node_result;

  IF cmd_utils.is_problem_result(prev_node_result) THEN
    CREATE TEMP TABLE __cmd_current_node_result AS
    SELECT * FROM cmd_utils.get_problem_result(prev_node_result);

  ELSIF cmd_utils.is_exit_result(prev_node_result) THEN
    CREATE TEMP TABLE __cmd_current_node_result AS
    SELECT * FROM cmd_utils.get_exit_result(prev_node_result);

  ELSE CREATE TEMP TABLE __cmd_current_node_result AS
    SELECT * FROM pg_temp.${HANDLER_FUNCTION_NAME}(prev_node_result);
  END IF;
  RETURN true;
END $$ LANGUAGE plpgsql;

DROP TABLE IF EXISTS __void;
SELECT pg_temp.${PREFIXER}__handle_cmd_node('${JSON_SOURCE}'::jsonb) INTO __void;
SELECT * FROM __cmd_current_node_result;
`
