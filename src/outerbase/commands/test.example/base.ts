import { $$type } from "@/lib/types"
import {
  JSNodeHandlerResult,
  defineCommand
} from "@/outerbase/system/command/shared"

import { ProfientaCommandsInterface } from "@/outerbase/commands/shared"

export const TestCommand = defineCommand({
  interface: ProfientaCommandsInterface,
  namespace: "test",
  id: "test.example",
  name: "Test Functionalities",
  path: "/test/command",
  method: "GET",
  queryParams: { a: true, b: true },
  headers: { "X-REQUIRED-HEADER": true, "X-OPTIONAL-HEADER": false },
  problems: ["DEFINED_PROBLEM"],
  payloadValidator: (query): query is Record<"a" | "b", string> => {
    if (typeof query !== "object") return false
    const theQuery = query as Record<string, unknown>
    if (typeof theQuery.a !== "string") return false
    if (typeof theQuery.b !== "string") return false
    return true
  },
  nodes: [
    {
      name: "Construct query",
      type: "js",
      resultType: $$type<JSNodeHandlerResult>()
    },
    {
      name: "Run query",
      type: "sql",
      resultType: $$type<{ name: string }[]>()
    },
    {
      name: "Finalize result",
      type: "js",
      resultType: $$type<JSNodeHandlerResult>()
    }
  ]
})
