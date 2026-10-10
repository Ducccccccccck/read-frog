import type { TermInsight } from "./types"
import { buildMatchKey } from "@/utils/glossary/match-key"

function keyOf(value: string): string {
  return buildMatchKey(value.trim().replace(/^[\s"'“”‘’([]+|[\s"'“”‘’)\].,;:!?]+$/g, ""), false)
}

/**
 * The page-pass entry for the selected text, ignoring case and surrounding
 * punctuation. `undefined` when the page pass did not cover it.
 */
export function findTermInsight(
  terms: readonly TermInsight[],
  selectedText: string,
): TermInsight | undefined {
  const wanted = keyOf(selectedText)
  if (!wanted) {
    return undefined
  }
  return terms.find((term) => keyOf(term.term) === wanted)
}
