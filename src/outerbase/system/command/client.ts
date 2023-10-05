// eslint-disable-next-line eslint-comments/disable-enable-pair
/* eslint-disable max-classes-per-file */

import { GuardedType, Indices } from "@/lib/types"

import {
  BaseBodyType,
  BaseQueryType,
  CommandDef,
  NodeResult,
  parseCommandResultJSON
} from "./shared"

/**
 * Method and body are ommitted because:
 * - Method is sourced from the definition of the command.
 * - Body is conditionally required/suppliable depending on the method.
 */
type CommandEndpointRequestInit = Omit<RequestInit, "method" | "body">

export type CommandEndpointResult<CmdDef extends CommandDef = CommandDef> =
  // Make the nodes into a generic to trigger distributivity. This is necessary to
  // make sure that a command def with a union of nodes (e.g. default
  // `CommandDef`) works
  CmdDef["nodes"] extends infer T1
    ? T1 extends CmdDef["nodes"]
      ? NodeResult<
          // The omit and intersection below are needed for a union of nodes to
          // work. The current node distributed over is used instead of the union.
          Omit<CmdDef, "nodes"> & { nodes: T1 } extends infer T2 extends CmdDef
            ? T2
            : never,
          // Trick to pick the highest index in a tuple
          Exclude<
            Indices<T1>,
            T1 extends [...infer T2, unknown] ? Indices<T2> : never
          >
        >
      : never
    : never

class CommandEndpointResponse<CmdDef extends CommandDef> extends Response {
  async json(): Promise<CommandEndpointResult<CmdDef>> {
    const resultText = await this.text()
    return parseCommandResultJSON(resultText) as CommandEndpointResult<CmdDef>
  }
}

async function fetchCommandEndpointResponse<CmdDef extends CommandDef>(
  ...fetchParams: Parameters<typeof fetch>
): Promise<CommandEndpointResponse<CmdDef>> {
  const response = await fetch(...fetchParams)
  return new CommandEndpointResponse<CmdDef>(response.body, response)
}

type CommandFetchHeadersParam<CmdDef extends CommandDef> =
  CmdDef["headers"] extends Record<string, unknown>
    ? {
        headers: { [K in keyof CmdDef["headers"]]?: string } & {
          // Remove optionality for required params
          [K in keyof CmdDef["headers"] as CmdDef["headers"][K] extends true
            ? K
            : never]-?: string
        }
      }
    : { headers?: undefined }

type CommandEndpointFetchParams<CmdDef extends CommandDef> = CmdDef extends {
  method: "GET" | "DELETE"
}
  ? {
      // This extraction should not have to be done. However, there're
      // limitations with typescript that I've not been able to work around.
      query: Extract<GuardedType<CmdDef["payloadValidator"]>, BaseQueryType>
      body?: undefined
      requestInit?: CommandEndpointRequestInit
    } & CommandFetchHeadersParam<CmdDef>
  : CmdDef extends { method: "POST" | "PUT" | "PATCH" }
  ? {
      body: Extract<GuardedType<CmdDef["payloadValidator"]>, BaseBodyType>
      query?: undefined
      requestInit?: CommandEndpointRequestInit
    } & CommandFetchHeadersParam<CmdDef>
  : never

export class CommandEndpoint<CmdDef extends CommandDef> {
  config: {
    command: CmdDef
    id: CmdDef["id"]
    path: CmdDef["path"]
    method: CmdDef["method"]
  }

  constructor(config: {
    command: CmdDef
    id: CmdDef["id"]
    path: CmdDef["path"]
    method: CmdDef["method"]
  }) {
    this.config = config
  }

  async fetch(params: CommandEndpointFetchParams<CmdDef>) {
    const response = await this.fetchResponse(params)
    return response.json()
  }

  async fetchResponse(params: CommandEndpointFetchParams<CmdDef>) {
    const { origin } = this.config.command.interface
    const {
      path,
      command: { method }
    } = this.config

    const endpointURL = new URL(path, origin)
    let init: RequestInit = {
      ...params.requestInit,
      method
    }

    if (params.query) {
      const { query } = params
      endpointURL.search = new URLSearchParams(query).toString()
    } else {
      const { body, headers } = params
      init = {
        ...init,
        headers: {
          ...init.headers,
          ...headers,
          "Content-Type":
            typeof body === "string" ? "text/plain" : "application/json"
        },
        body: JSON.stringify(body)
      }
    }

    return fetchCommandEndpointResponse<CmdDef>(endpointURL, init)
  }
}
