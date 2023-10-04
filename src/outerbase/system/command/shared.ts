import { tryJSONParse } from "@/lib/parse"
import {
  GuardedType,
  JSONObject,
  $$type,
  Extract$$type,
  TupleSelectFromStart,
  TupleObjectsMap
} from "@/lib/types"

interface OuterbaseSQLErrorResult {
  success: false
  error: {
    code: string
    title: string
    description: string
  }
}

interface OuterbaseSQLSuccessResult<Items extends JSONObject[]> {
  success: true
  response: {
    items: Items
  }
}

/**
 * Intersecting the base JSON object type with the unique key
 * is to make sure that JSON results returned by the proxy are distinguishable
 * and discriminable since outerbase controls the root JSON structure of return
 * values of SQL nodes.
 */
type SQLNodeHandlerReturnRow = JSONObject & {
  __cmd_type__?: never
}

export type SQLNodeHandlerDefinedResult<
  Items extends SQLNodeHandlerReturnRow[] = SQLNodeHandlerReturnRow[]
> = Items

export interface JSNodeHandlerDefinedSuccessResult<
  Data extends JSONObject = JSONObject
> {
  data: Data
  __cmd_type__: "js_node_success_result"
}

export interface JSNodeHandlerDefinedErrorResult<
  ErrorCode extends string = string
> {
  __cmd_type__: "js_node_error_result"
  errors: {
    code: ErrorCode
    message: string
  }[]
}

export type JSNodeHandlerDefinedResult<
  SuccessData extends JSONObject = JSONObject,
  ErrorCode extends string = string
> =
  | JSNodeHandlerDefinedSuccessResult<SuccessData>
  | JSNodeHandlerDefinedErrorResult<ErrorCode>

export type NodeProxyErrorCode =
  | "__PROXY_INVALID_BODY_OR_QUERY__"
  | "__PROXY_INTERNAL_PARSING_ERROR__"
  | "__PROXY_MISSING_REQUIRED_HEADERS__"

// eslint-disable-next-line @typescript-eslint/consistent-type-definitions
type UnwrappedNodeProxyResult = {
  __cmd_type__: "node_proxy_result"
  error: {
    code: NodeProxyErrorCode
    message: string
  }
}

export type JSNodeProxyResult = UnwrappedNodeProxyResult
export type SQLNodeProxyResult = OuterbaseSQLSuccessResult<
  [UnwrappedNodeProxyResult]
>

export type NodeProxyResult = JSNodeProxyResult | SQLNodeProxyResult

type UnwrappedNodeProblemResult<CmdDef extends CommandDef> =
  CmdDef["problems"] extends []
    ? never
    : {
        __cmd_type__: "cmd_problem_result"
        error: {
          code: CmdDef["problems"][number]
          message: string
        }
      }

export type JSNodeHandlerProblemResult<CmdDef extends CommandDef> =
  UnwrappedNodeProblemResult<CmdDef>

export type JSNodeProblemResult<CmdDef extends CommandDef> =
  UnwrappedNodeProblemResult<CmdDef>

export type SQLNodeProblemResult<CmdDef extends CommandDef> =
  UnwrappedNodeProblemResult<CmdDef> extends never
    ? never
    : OuterbaseSQLSuccessResult<[UnwrappedNodeProblemResult<CmdDef>]>

export type NodeProblemResult<CmdDef extends CommandDef> =
  | JSNodeProblemResult<CmdDef>
  | SQLNodeProblemResult<CmdDef>

export type HandlerDefinedResultToNodeResult<
  CmdDef extends CommandDef,
  Result extends JSNodeHandlerDefinedResult | SQLNodeHandlerDefinedResult
> = Result extends SQLNodeHandlerDefinedResult
  ?
      | OuterbaseSQLSuccessResult<Result>
      | OuterbaseSQLErrorResult
      | SQLNodeProxyResult
      | SQLNodeProblemResult<CmdDef>
  : Result extends JSNodeHandlerDefinedResult
  ? Result | JSNodeProxyResult | JSNodeProblemResult<CmdDef>
  : never

type CommandMethod = "GET" | "POST" | "PUT" | "PATCH" | "DELETE"

export const defineCommandsInterface = <
  Origin extends string,
  Methods extends CommandMethod[],
  Namespaces extends string[]
>(config: {
  origin: Origin
  methods: [...Methods]
  namespaces: [...Namespaces]
}) => config

export type CommandsInterfaceDef = ReturnType<typeof defineCommandsInterface>

export interface JSNodeConfig {
  name: string
  type: "js"
  isAsync?: boolean
  resultType: $$type<JSNodeHandlerDefinedResult>
}

export interface SQLNodeConfig {
  name: string
  type: "sql"
  resultType: $$type<SQLNodeHandlerDefinedResult>
}

// This is meant to be a union of command layouts. Each layout is a tuple.
type CommandNodesConfig =
  | [JSNodeConfig]
  | [JSNodeConfig, SQLNodeConfig, JSNodeConfig]

/**
 * This type provides all things about a node at the simplest level; just
 * everything a node can/should possibly access. For example, a second node can
 * access request params and result from first node, so this type returns those
 * in `args`, though the handler for the node might not be passed all of those
 * depending on the proxy.
 */
export interface RawCommandNodeSchema<
  CmdDef extends CommandDef,
  NodeIndex extends number
> {
  /** These arguments are determined by the proxy for the respective node */
  args: [
    {
      payload: GuardedType<CmdDef["payloadValidator"]>
      headers: CmdDef["headers"] extends null
        ? null
        : {
            [K in keyof CmdDef["headers"]]: CmdDef["headers"][K] extends true
              ? string
              : string | undefined
          }
    },
    ...(TupleSelectFromStart<
      CmdDef["nodes"],
      NodeIndex
    > extends infer T1 extends CmdDef["nodes"][number][]
      ? TupleObjectsMap<T1, "resultType"> extends infer T2 extends (
          | $$type<JSNodeHandlerDefinedResult>
          | $$type<SQLNodeHandlerDefinedResult>
        )[]
        ? {
            [K in keyof T2]: HandlerDefinedResultToNodeResult<
              CmdDef,
              Extract$$type<T2[K]>
            >
          } extends infer T3 extends readonly unknown[]
          ? T3
          : never
        : never
      : never)
  ]
  result: Extract$$type<CmdDef["nodes"][NodeIndex]["resultType"]>
}

type CommandID<Namespace extends CommandsInterfaceDef["namespaces"][number]> =
  `${Namespace}.${string}`

type CommandPath<Namespace extends CommandsInterfaceDef["namespaces"][number]> =
  `/${Namespace}` | `/${Namespace}/${string}`

export type BaseQueryType = Record<string, string>
// To pass a string value as body, nest it in an object
export type BaseBodyType = JSONObject

type QueryValidator = (query: unknown) => query is BaseQueryType
type BodyValidator = (query: unknown) => query is BaseBodyType

type CommandQueryParamsConfig<
  Method extends CommandMethod,
  Validator extends QueryValidator | BodyValidator
> = Method extends "GET" | "DELETE"
  ? {
      queryParams: Record<keyof GuardedType<Validator>, unknown> &
        Record<string, unknown>
    }
  : { queryParams?: undefined }

/**
 * Define an outerbase command. The result of this is used in different places
 * including the following:
 * - Command Generator
 * - Command Node Proxy
 * - Commands Client
 */
export const defineCommand = <
  InterfaceDef extends CommandsInterfaceDef,
  Namespace extends InterfaceDef["namespaces"][number],
  NodesConfig extends CommandNodesConfig,
  Path extends CommandPath<Namespace>,
  ID extends CommandID<Namespace>,
  Method extends InterfaceDef["methods"][number],
  // The boolean indicates whether the header is required or not
  Headers extends Record<string, boolean> | null,
  Problems extends string[],
  PayloadValidator extends Method extends "GET" | "DELETE"
    ? QueryValidator
    : Method extends "POST" | "PUT" | "PATCH"
    ? BodyValidator
    : never
>(
  commandConfig: {
    name: string
    interface: InterfaceDef
    namespace: Namespace
    nodes: NodesConfig
    path: Path
    id: ID
    method: Method
    headers: Headers
    problems: [...Problems]
    payloadValidator: PayloadValidator
  } & CommandQueryParamsConfig<Method, PayloadValidator>
) => commandConfig

export type CommandDef = ReturnType<typeof defineCommand>

export function parseCommandResultJSON(result: string): unknown {
  const parseResult = tryJSONParse(result)
  if (parseResult.success) return parseResult.value

  /**
   * Handle the case where outerbase returns malformed JSON. The malformed
   * JSON looks like the following.
   *
   * ```json
   * {{"success":false,"error":{"code":"CONFLICT","title":"Error executing query",
   * "description":"syntax error at or near \":\""}}}: 409
   * ```
   *
   * Basically, we have to remove the extra opening curly brace at the
   * beginning, and the last one at the end including the colon and http code.
   * We also make sure to match any leading or trailing whitespace.
   * At this point we'll also let it throw an error if it still doesn't match.
   */
  return JSON.parse(result.replace(/^\s*{(.+)}:\s*\d{3}\s*$/, "$1")) as unknown
}

export function tryCommandResultJSONParse(
  result: string
): { success: true; value: unknown } | { success: false } {
  try {
    const parseResult = parseCommandResultJSON(result)
    return { success: true, value: parseResult }
  } catch {
    return { success: false }
  }
}
