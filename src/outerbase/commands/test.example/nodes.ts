import {
  JSNodeHandler,
  SQLNodeHandlerDefiner,
  sql
} from "@/outerbase/system/command"
import { type TestCommand } from "./base"

export const NODE_ONE: JSNodeHandler<typeof TestCommand, 0> = ({
  payload,
  headers
}) => {
  if (payload.a === "return_problem")
    return {
      source: "js",
      payload: {
        __cmd_type__: "cmd_problem_result",
        error: {
          code: "DEFINED_PROBLEM",
          message: `Triggered. Headers: ${JSON.stringify(headers)}`
        }
      }
    }
  const name = "some-name"
  return {
    source: "js",
    payload: { data: { name } }
  }
}

export const NODE_TWO: SQLNodeHandlerDefiner<typeof TestCommand, 1> = ({
  HANDLER_FUNCTION_NAME
}) => sql<{ name: string }[]>`
  -- Define the temporary function within the pg_temp schema
  CREATE OR REPLACE FUNCTION pg_temp.${HANDLER_FUNCTION_NAME}(prev_data jsonb)
  RETURNS TABLE (type text) AS $$
  BEGIN
    RETURN QUERY SELECT 'text-data' AS type;
  END;
  $$ LANGUAGE plpgsql;
`

export const NODE_THREE: JSNodeHandler<typeof TestCommand, 2> = (...params) => {
  const age = 3
  return {
    source: "js",
    payload: {
      data: {
        age,
        talk: "from third node handler",
        thirdNodeParams: JSON.stringify(params)
      }
    }
  }
}
