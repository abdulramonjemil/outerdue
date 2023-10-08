import { tryJSONParse } from "@/lib/parse"
import {
  GuardedType,
  JSONObject,
  $$type,
  Extract$$type,
  TupleSpliceFromStart,
  JSONValue
} from "@/lib/types"

type OuterbaseSQLErrorResult = {
  success: false
  error: {
    code: string
    title: string
    description: string
  }
}

type OuterbaseSQLSuccessResult<Items extends JSONObject[]> = {
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
  __type__?: undefined
}

export type SQLNodeHandlerDefinedResult<
  Items extends SQLNodeHandlerReturnRow[] = SQLNodeHandlerReturnRow[]
> = Items

export type JSNodeResult<
  // 'undefined' is allowed to allow defining optionally undefined properties
  // which is useful for discrimination
  Payload extends Record<string, JSONValue | undefined>
> = {
  source: "js"
  payload: Payload
}

export type JSNodeHandlerDefinedSuccessResult<
  Data extends JSONObject = JSONObject
> = {
  data: Data
  error?: undefined
  __type__?: undefined
}

export type JSNodeHandlerDefinedErrorResult<ErrorCode extends string = string> =
  {
    error: {
      code: ErrorCode
      message: string
    }
    data?: undefined
    __type__?: undefined
  }

export type JSNodeHandlerDefinedResult<
  SuccessData extends JSONObject = JSONObject,
  ErrorCode extends string = string
> =
  | JSNodeHandlerDefinedSuccessResult<SuccessData>
  | JSNodeHandlerDefinedErrorResult<ErrorCode>

export type NodeProblemCode =
  | "INVALID_BODY_OR_QUERY"
  | "INTERNAL_PARSING_ERROR"
  | "MISSING_REQUIRED_HEADERS"

// eslint-disable-next-line @typescript-eslint/consistent-type-definitions
type UnwrappedProblemResult = {
  __type__: "problem_result"
  error: {
    code: NodeProblemCode
    message: string
  }
}

export type JSNodeProblemResult = JSNodeResult<UnwrappedProblemResult>
export type SQLNodeProblemResult = OuterbaseSQLSuccessResult<
  [UnwrappedProblemResult]
>

export type NodeProblemResult = JSNodeProblemResult | SQLNodeProblemResult

type UnwrappedExitResult<CmdDef extends CommandDef> =
  CmdDef["exitCodes"] extends []
    ? never
    : {
        __type__: "exit_result"
        info: {
          code: CmdDef["exitCodes"][number]
          message: string
        }
      }

export type JSNodeHandlerExitResult<CmdDef extends CommandDef> =
  UnwrappedExitResult<CmdDef>

export type JSNodeExitResult<CmdDef extends CommandDef> = JSNodeResult<
  UnwrappedExitResult<CmdDef>
>

export type SQLNodeExitResult<CmdDef extends CommandDef> =
  UnwrappedExitResult<CmdDef> extends never
    ? never
    : OuterbaseSQLSuccessResult<[UnwrappedExitResult<CmdDef>]>

export type NodeExitResult<CmdDef extends CommandDef> =
  | JSNodeExitResult<CmdDef>
  | SQLNodeExitResult<CmdDef>

export type NodeResult<
  CmdDef extends CommandDef,
  NodeIndex extends number
> = Extract$$type<
  CmdDef["nodes"][NodeIndex]["resultType"]
> extends infer T extends
  | JSNodeHandlerDefinedResult
  | SQLNodeHandlerDefinedResult
  ? T extends SQLNodeHandlerDefinedResult
    ?
        | OuterbaseSQLSuccessResult<T>
        | OuterbaseSQLErrorResult
        | SQLNodeProblemResult
        | SQLNodeExitResult<CmdDef>
    : T extends infer T1 extends JSNodeHandlerDefinedResult
    ? JSNodeResult<T1> | JSNodeProblemResult | JSNodeExitResult<CmdDef>
    : never
  : never

type CommandMethod = "GET" | "POST" | "PUT" | "PATCH" | "DELETE"

export const defineCommandInterface = <
  Origin extends string,
  Prefix extends string | null,
  Methods extends [CommandMethod, ...CommandMethod[]],
  Namespaces extends [string, ...string[]]
>(config: {
  origin: Origin
  prefix: Prefix
  methods: [...Methods]
  namespaces: [...Namespaces]
}) => config

export type CommandInterfaceDef = ReturnType<typeof defineCommandInterface>

export type JSNodeConfig = {
  name: string
  type: "js"
  isAsync?: boolean
  resultType: $$type<JSNodeHandlerDefinedResult>
}

export type SQLNodeConfig = {
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
export type RawCommandNodeSchema<
  CmdDef extends CommandDef,
  NodeIndex extends number
> = {
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

    ...(TupleSpliceFromStart<
      CmdDef["nodes"],
      NodeIndex
    > extends infer T1 extends CmdDef["nodes"][number][]
      ? {
          [K in keyof T1]: K extends `${infer T2 extends number}`
            ? NodeResult<CmdDef, T2>
            : never
        } extends infer T3 extends readonly unknown[]
        ? T3
        : never
      : never)
  ]
  result: Extract$$type<CmdDef["nodes"][NodeIndex]["resultType"]>
}

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
      queryParams: Record<keyof GuardedType<Validator>, true>
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
  InterfaceDef extends CommandInterfaceDef,
  Namespace extends InterfaceDef["namespaces"][number],
  NodesConfig extends CommandNodesConfig,
  Path extends `/${Namespace}` | `/${Namespace}/${string}`,
  ID extends `${InterfaceDef["prefix"] extends string
    ? `${InterfaceDef["prefix"]}.`
    : ""}${Namespace}.${string}`,
  Method extends InterfaceDef["methods"][number],
  Headers extends Record<string, boolean> | null,
  ExitCodes extends string[],
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
    exitCodes: [...ExitCodes]
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
