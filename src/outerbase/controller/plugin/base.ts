import "construct-style-sheets-polyfill"

type ConstructorParameters<T> =
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  T extends new (...args: infer P) => any ? P : never

const css = String.raw

// The whole `@import ...` in the css below is meant to be used as a
// placeholder, and will be replaced with the actual output of tailwindcss.
const STYLE_SHEET = css`
  @import url("__STYLES_PLACEHOLDER_FOR_TAILWINDCSS_OUTPUT__");
`

/**
 * Raw string is included in the name to signify that the replacement string
 * should be a raw string too valid in template tagged `String.raw`
 */
export const RAW_STRING_STYLE_SHEET_PLACEHOLDER =
  // eslint-disable-next-line quotes
  '@import url("__STYLES_PLACEHOLDER_FOR_TAILWINDCSS_OUTPUT__");'

export class PluginCSSStyleSheet extends CSSStyleSheet {
  constructor(...args: ConstructorParameters<typeof CSSStyleSheet>) {
    super(...args)
    this.replaceSync(STYLE_SHEET)
  }
}
