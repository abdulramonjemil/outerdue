import { tryJSONParse } from "@/lib/parse"
import type { GuardedType, JSONValue } from "@/lib/types"

import { type CommandEndpointResult } from "./client"
import {
  NodeProxyErrorCode,
  tryCommandResultJSONParse,
  CommandDef,
  JSNodeProxyResult,
  SQLNodeProxyResult,
  JSNodeProblemResult,
  SQLNodeProblemResult,
  JSNodeConfig,
  JSNodeProxyProxyResult
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

const getReturnProxyErrorResult = (
  code: NodeProxyErrorCode,
  message: string
): JSNodeProxyResult => ({
  source: "js",
  payload: {
    error: { code, message },
    __cmd_type__: "node_proxy_result"
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
  if (headers === null) return { success: true, empty: true }

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

const isJSNodeProxyResult = (value: unknown): value is JSNodeProxyResult => {
  const val = value as JSNodeProxyResult
  // eslint-disable-next-line @typescript-eslint/no-unnecessary-boolean-literal-compare, @typescript-eslint/no-unnecessary-condition, no-underscore-dangle
  return val.payload?.__cmd_type__ === "node_proxy_result"
}

const isSQLNodeProxyResult = (value: unknown): value is SQLNodeProxyResult => {
  const val = value as SQLNodeProxyResult
  // eslint-disable-next-line @typescript-eslint/no-unnecessary-boolean-literal-compare, @typescript-eslint/no-unnecessary-condition, no-underscore-dangle
  return val.response?.items?.[0]?.__cmd_type__ === "node_proxy_result"
}

const isJSNodeProblemResult = (
  value: unknown
): value is JSNodeProblemResult<CommandDef> => {
  const val = value as JSNodeProblemResult<CommandDef>
  // eslint-disable-next-line @typescript-eslint/no-unnecessary-boolean-literal-compare, @typescript-eslint/no-unnecessary-condition, no-underscore-dangle
  return val.payload?.__cmd_type__ === "cmd_problem_result"
}

const isSQLNodeProblemResult = (
  value: unknown
): value is SQLNodeProblemResult<CommandDef> => {
  const val = value as SQLNodeProblemResult<CommandDef>
  // eslint-disable-next-line @typescript-eslint/no-unnecessary-boolean-literal-compare, @typescript-eslint/no-unnecessary-condition, no-underscore-dangle
  return val.response?.items?.[0]?.__cmd_type__ === "cmd_problem_result"
}

type CommandDefWithJSNodeOnly = Omit<CommandDef, "nodes"> & {
  nodes: [JSNodeConfig]
}

type ProxyReturn =
  | JSNodeProxyProxyResult
  | JSNodeHandlerReturn<CommandDefWithJSNodeOnly, 0>

export function JSNodeProxy({
  nodeHandler,
  nodeIndex,
  commandDefinition
}: {
  nodeHandler: (...args: unknown[]) => JSNodeHandlerReturn<CommandDef, number>
  nodeIndex: number
  commandDefinition: CommandDef
}): ProxyReturn {
  const paramValidationInfo = getParamValidationInfo(commandDefinition)

  if (paramValidationInfo.status === "error") {
    return getReturnProxyErrorResult(
      "__PROXY_INVALID_BODY_OR_QUERY__",
      `The request '${paramValidationInfo.paramType}' does not match the specified type`
    )
  }

  const headersValidationInfo = getHeadersValidationInfo(commandDefinition)

  if (!headersValidationInfo.success) {
    return getReturnProxyErrorResult(
      "__PROXY_MISSING_REQUIRED_HEADERS__",
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
    return getReturnProxyErrorResult(
      "__PROXY_INTERNAL_PARSING_ERROR__",
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

    if (isJSNodeProxyResult(lastResult)) {
      return getReturnProxyErrorResult(
        lastResult.payload.error.code,
        lastResult.payload.error.message
      )
    }

    if (isSQLNodeProxyResult(lastResult)) {
      return getReturnProxyErrorResult(
        lastResult.response.items[0].error.code,
        lastResult.response.items[0].error.message
      )
    }

    /**
     * If a problem result is detected, don't call the handler, just return the
     * result. It is expected that the next node's proxy would do the same.
     */
    if (isJSNodeProblemResult(lastResult)) return lastResult
    if (isSQLNodeProblemResult(lastResult)) {
      // Normalize the wrapped result
      return {
        source: "js",
        payload: {
          __cmd_type__: "cmd_problem_result",
          error: {
            code: lastResult.response.items[0].error.code,
            message: lastResult.response.items[0].error.message
          }
        }
      }
    }
  }

  // See the schema for command nodes for parameter types
  return nodeHandler.apply(null, [
    {
      payload: paramValidationInfo.paramValue,
      headers: headersValidationInfo.empty ? null : headersValidationInfo.values
    },
    ...prevNodeResultsData.results
  ])
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

  IF cmd_proxy.is_proxy_result(prev_node_result) THEN
    CREATE TEMP TABLE __cmd_current_node_result AS
    SELECT * FROM cmd_proxy.get_proxy_result(prev_node_result);

  ELSIF cmd_proxy.is_problem_result(prev_node_result) THEN
    CREATE TEMP TABLE __cmd_current_node_result AS
    SELECT * FROM cmd_proxy.get_problem_result(prev_node_result);

  ELSE CREATE TEMP TABLE __cmd_current_node_result AS
    SELECT * FROM pg_temp.${HANDLER_FUNCTION_NAME}(prev_node_result);
  END IF;
  RETURN true;
END $$ LANGUAGE plpgsql;

DROP TABLE IF EXISTS __void;
SELECT pg_temp.${PREFIXER}__handle_cmd_node('${JSON_SOURCE}'::jsonb) INTO __void;
SELECT * FROM __cmd_current_node_result;
`
