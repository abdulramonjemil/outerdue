import { LastItem } from "@/lib/types"

import {
  CommandDef,
  RawCommandNodeSchema,
  JSNodeHandlerResult,
  NodeProxyResult,
  SQLNodeHandlerResult,
  NodeProblemResult,
  NodeHandlerProblemResult
} from "./shared"

type JSNodeHandlerArgs<
  CmdDef extends CommandDef,
  NodeIndex extends number
> = RawCommandNodeSchema<CmdDef, NodeIndex>["args"] extends infer T extends
  readonly unknown[]
  ? {
      [K in keyof T]: Exclude<T[K], NodeProxyResult | NodeProblemResult<CmdDef>>
    }
  : never

export type JSNodeHandlerReturn<
  CmdDef extends CommandDef,
  NodeIndex extends number
> = RawCommandNodeSchema<CmdDef, NodeIndex>["result"] extends infer T extends
  RawCommandNodeSchema<CmdDef, NodeIndex>["result"]
  ? [T] extends [JSNodeHandlerResult]
    ? CmdDef["nodes"][NodeIndex] extends { type: "js" }
      ? CmdDef["nodes"][NodeIndex]["isAsync"] extends true
        ? Promise<T | NodeHandlerProblemResult<CmdDef>>
        : T | NodeHandlerProblemResult<CmdDef>
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

type MaskedSQLNodeResult<Result extends SQLNodeHandlerResult> = string & {
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
  ? [T] extends [SQLNodeHandlerResult]
    ? (...args: SQLNodeHandlerParams) => MaskedSQLNodeResult<T>
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
      NodeProxyResult | NodeProblemResult<CmdDef>
    >
  : never

/**
 * SQL nodes defined using this function must define a function named
 * `pg_temp.handle_outerbase_command` using the following syntax:
 *
 * ```sql
 * CREATE OR REPLACE FUNCTION pg_temp.handle_outerbase_command(...)
 * ```
 *
 * Only this way does the string count as a valid SQL node. The function is
 * called by the SQL node proxy conditionally (when there's no previous detected
 * errors).
 */
export const sql = <Result extends SQLNodeHandlerResult>(
  ...args: Parameters<typeof String.raw>
) => String.raw(...args) as MaskedSQLNodeResult<Result>
