export const TERM_CARD_CONTEXT_RADIUS = 300

/**
 * The part of `context` around `text`: the whole paragraph can be thousands of
 * characters, and the model call only needs the sentences near the selection.
 * Falls back to the start of the context when the text is not found in it.
 */
export function windowContext(
  context: string,
  text: string,
  radius = TERM_CARD_CONTEXT_RADIUS,
): string {
  const flat = context.replace(/\s+/g, " ").trim()
  const needle = text.replace(/\s+/g, " ").trim()
  if (flat.length <= radius * 2 + needle.length) {
    return flat
  }

  const index = needle ? flat.toLowerCase().indexOf(needle.toLowerCase()) : -1
  if (index === -1) {
    return flat.slice(0, radius * 2)
  }

  const start = Math.max(0, index - radius)
  const end = Math.min(flat.length, index + needle.length + radius)
  return `${start > 0 ? "…" : ""}${flat.slice(start, end)}${end < flat.length ? "…" : ""}`
}
