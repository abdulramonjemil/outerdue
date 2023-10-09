import { JSNodeHandler, SQLNodeHandlerDefiner, sql } from "@/system/command"
import { type TestCommand } from "./base"

export const NODE_ONE: JSNodeHandler<typeof TestCommand, 0> = ({
  payload,
  headers
}) => {
  if (payload.a === "return_exit")
    return {
      __type__: "exit_result",
      info: {
        code: "SOME_EXIT_CODE",
        message: `Triggered. Headers: ${JSON.stringify(headers)}`
      }
    }

  return { data: { name: "some-name" } }
}

export const NODE_TWO: SQLNodeHandlerDefiner<typeof TestCommand, 1> = ({
  HANDLER_FUNCTION_NAME
}) => sql<{ name: string }[]>`
  -- Define the temporary function within the pg_temp schema
  CREATE OR REPLACE FUNCTION pg_temp.${HANDLER_FUNCTION_NAME}(prev_data jsonb)
  RETURNS TABLE (name text) AS $$
  BEGIN
    RETURN QUERY SELECT 'text-data' AS name;
  END;
  $$ LANGUAGE plpgsql;
`

export const NODE_THREE: JSNodeHandler<typeof TestCommand, 2> = (...params) => {
  const age = 3
  return {
    data: {
      age,
      talk: "from third node handler",
      thirdNodeParams: JSON.stringify(params)
    }
  }
}
