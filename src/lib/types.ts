export type If<
  Condition extends boolean,
  T1,
  T2,
  T3 = never
> = Condition extends true ? T1 : Condition extends false ? T2 : T3

export type IsSameType<T1, T2> = [T1] extends [T2]
  ? [T2] extends [T1]
    ? true
    : false
  : false

export type NonNegativeRangeList<
  To extends number,
  IncludeTo extends boolean = false,
  // eslint-disable-next-line @typescript-eslint/naming-convention
  __Current extends number[] = [0]
> = number extends To
  ? never
  : `${To}` extends `${0}` | `-${number}` | `${number}.${number}`
  ? never
  : To extends __Current["length"]
  ? If<IncludeTo, [...__Current, __Current["length"]], __Current>
  : NonNegativeRangeList<To, IncludeTo, [...__Current, __Current["length"]]>

export type TupleSpliceFromStart<
  Tuple extends [...unknown[]],
  EndIndex extends number,
  IncludeEndIndexType extends boolean = false,
  // eslint-disable-next-line @typescript-eslint/naming-convention
  __Current extends unknown[] = []
> = number extends EndIndex
  ? never
  : `${EndIndex}` extends `-${number}` | `${number}.${number}`
  ? never
  : EndIndex extends __Current["length"]
  ? If<
      IncludeEndIndexType,
      [...__Current, Tuple[__Current["length"]]],
      __Current
    >
  : TupleSpliceFromStart<
      Tuple,
      EndIndex,
      IncludeEndIndexType,
      [...__Current, Tuple[__Current["length"]]]
    >

export type GuardedType<F extends (arg: unknown) => arg is unknown> =
  F extends (arg: unknown) => arg is infer Type ? Type : never

export type Indices<T extends readonly unknown[]> = Exclude<
  Partial<T>["length"],
  T["length"]
> &
  number

export type LastItem<Tuple extends readonly unknown[]> = Tuple extends [
  ...unknown[],
  infer T
]
  ? T
  : never

/**
 * This utility and it's companions is meant to be a way to pass
 * types of values without actually accessing the value allowing those values to
 * be purged during build
 */
/* eslint-disable @typescript-eslint/naming-convention */
const $$__type_only__STORED_TYPE = Symbol("STORED_TYPE")
const $$__type_only__TYPE_PLACEHOLDER = Symbol("TYPE_PLACEHOLDER")
/* eslint-enable @typescript-eslint/naming-convention */

export type $$type<Type> = {
  [$$__type_only__STORED_TYPE]: Type
}

/**
 * Although this value is a function, it is not meant to be called as one.
 * Just pass the type to define as a type parameter and extract it later with
 * `Extract$$type`
 */
// eslint-disable-next-line @typescript-eslint/no-redeclare
export const $$type = <Type = typeof $$__type_only__TYPE_PLACEHOLDER>(
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  ..._: Type extends typeof $$__type_only__TYPE_PLACEHOLDER
    ? [
        info: "This function should be passed a type parameter",
        enforcer: typeof $$__type_only__TYPE_PLACEHOLDER
      ]
    : []
) => ({}) as $$type<Type>

/**
 * There's an issue with this where the following works:
 *
 * ```ts
 * const x1: $$typedef<string> = $$type
 * ```
 *
 * We dont want the `$$type` function without a parameter to go through.
 * So, this is pending until we can find a way to enforce that.
 */
// export type $$typedef<Type> = $$type<Type> | typeof $$type<Type>

export type Extract$$type<TypeDef extends $$type<unknown>> =
  TypeDef extends $$type<infer T> ? T : never

export type UnionToIntersection<U> = (
  U extends unknown ? (k: U) => void : never
) extends (k: infer I) => void
  ? I
  : never

export type JSONLiteral = string | number | boolean | null
export type JSONValue = JSONLiteral | { [key: string]: JSONValue } | JSONValue[]
export type JSONObject = Record<string, JSONValue>
