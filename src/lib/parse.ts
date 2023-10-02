export function tryJSONParse(
  value: string
): { success: true; value: unknown } | { success: false } {
  try {
    const parseResult = JSON.parse(value) as unknown
    return { success: true, value: parseResult }
  } catch {
    return { success: false }
  }
}
