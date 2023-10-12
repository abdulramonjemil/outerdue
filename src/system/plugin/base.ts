import "construct-style-sheets-polyfill"

type ConstructorParameters<T> =
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  T extends new (...args: infer P) => any ? P : never

const css = String.raw

// The comment below will be replaced with the actual output of postcss.
const STYLE_SHEET = css`
  /* __STYLES_PLACEHOLDER_FOR_STYLESHEET_OUTPUT__ */
`

/**
 * Raw string is included in the name to signify that the replacement string
 * should be a raw string too valid in template tagged `String.raw`.
 *
 * The pattern below matches the comment and accounts for spaces that might be
 * added automatically by formatter (since `css` effectively means letting the
 * formatter treat the string as css source.)
 */
export const RAW_STRING_STYLE_SHEET_PLACEHOLDER =
  "/* __STYLES_PLACEHOLDER_FOR_STYLESHEET_OUTPUT__ */"

export class PluginCSSStyleSheet extends CSSStyleSheet {
  constructor(...args: ConstructorParameters<typeof CSSStyleSheet>) {
    super(...args)
    this.replaceSync(STYLE_SHEET)
  }
}
