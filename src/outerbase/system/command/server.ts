import { LastItem } from "@/lib/types"

import {
  CommandDef,
  RawCommandNodeSchema,
  JSNodeHandlerDefinedResult,
  NodeProxyResult,
  SQLNodeHandlerDefinedResult,
  NodeExitResult,
  JSNodeHandlerExitResult
} from "./shared"

type JSNodeHandlerArgs<
  CmdDef extends CommandDef,
  NodeIndex extends number
> = RawCommandNodeSchema<CmdDef, NodeIndex>["args"] extends infer T extends
  readonly unknown[]
  ? {
      [K in keyof T]: Exclude<T[K], NodeProxyResult | NodeExitResult<CmdDef>>
    }
  : never

export type JSNodeHandlerReturn<
  CmdDef extends CommandDef,
  NodeIndex extends number
> = RawCommandNodeSchema<CmdDef, NodeIndex>["result"] extends infer T extends
  RawCommandNodeSchema<CmdDef, NodeIndex>["result"]
  ? [T] extends [JSNodeHandlerDefinedResult]
    ? CmdDef["nodes"][NodeIndex] extends { type: "js" }
      ? CmdDef["nodes"][NodeIndex]["isAsync"] extends true
        ? Promise<T | JSNodeHandlerExitResult<CmdDef>>
        : T | JSNodeHandlerExitResult<CmdDef>
      : never
    : never
  : never

export type JSNodeHandler<
  CmdDef extends CommandDef,
  NodeIndex extends number
> = CmdDef["nodes"][NodeIndex]["type"] extends "js"
  ? (
      ...args: JSNodeHandlerArgs<CmdDef, NodeIndex>
    ) => JSNodeHandlerReturn<CmdDef, NodeIndex>
  : never

// eslint-disable-next-line @typescript-eslint/naming-convention
const $$__type_only__SQL_NODE_RESULT = Symbol("$$SQL_NODE_RESULT")

type MaskedSQLNodeHandlerDefinedResult<
  Result extends SQLNodeHandlerDefinedResult
> = string & {
  [$$__type_only__SQL_NODE_RESULT]: Result
}

type SQLNodeHandlerParams = [{ HANDLER_FUNCTION_NAME: string }]

/**
 * This type is meant to be used when defining command nodes. It allows for
 * defining a node handler based on the type defined in the command. The actual
 * return type of a node handler function is a string but this asserts it to
 * something else to provide more type safety (used with `sql`).
 */
export type SQLNodeHandlerDefiner<
  CmdDef extends CommandDef,
  NodeIndex extends number
> = RawCommandNodeSchema<CmdDef, NodeIndex>["result"] extends infer T extends
  RawCommandNodeSchema<CmdDef, NodeIndex>["result"]
  ? [T] extends [SQLNodeHandlerDefinedResult]
    ? (...args: SQLNodeHandlerParams) => MaskedSQLNodeHandlerDefinedResult<T>
    : never
  : never

export type RawSQLNodeHandlerDefiner = (...args: SQLNodeHandlerParams) => string

export type SQLNodeHandlerParam<
  CmdDef extends CommandDef,
  NodeIndex extends number
> = NodeIndex extends 0
  ? // The value 'null' is passed to the node handler if the SQL node is the first
    null
  : CmdDef["nodes"][NodeIndex]["type"] extends "sql"
  ? Exclude<
      LastItem<RawCommandNodeSchema<CmdDef, NodeIndex>["args"]>,
      NodeProxyResult | NodeExitResult<CmdDef>
    >
  : never

export const sql = <Result extends SQLNodeHandlerDefinedResult>(
  ...args: Parameters<typeof String.raw>
) => String.raw(...args) as MaskedSQLNodeHandlerDefinedResult<Result>
