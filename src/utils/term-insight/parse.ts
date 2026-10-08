import type { TermInsight } from "./types"
import { MAX_TERMS_PER_PAGE, termInsightSchema } from "./types"

const CODE_FENCE_RE = /^```(?:json)?\s*|\s*```$/gi

/**
 * Pull a JSON value out of a model answer that may be wrapped in a code fence
 * or surrounded by chatter. Returns `undefined` when nothing parses.
 */
function extractJson(raw: string): unknown {
  const unfenced = raw.trim().replace(CODE_FENCE_RE, "").trim()

  try {
    return JSON.parse(unfenced)
  } catch {
    // fall through to the bracket search
  }

  const start = unfenced.indexOf("[")
  const end = unfenced.lastIndexOf("]")
  if (start !== -1 && end > start) {
    try {
      return JSON.parse(unfenced.slice(start, end + 1))
    } catch {
      return undefined
    }
  }
  return undefined
}

/**
 * Parse the model's answer into valid terms.
 *
 * Tolerant on purpose: one malformed entry must not discard the rest, so each
 * item is validated alone. Duplicates (case-insensitive) keep the first one.
 * Accepts either a bare array or `{ "terms": [...] }`.
 */
export function parseTermInsights(raw: string): TermInsight[] {
  const json = extractJson(raw)
  const items = Array.isArray(json)
    ? json
    : json && typeof json === "object" && Array.isArray((json as { terms?: unknown }).terms)
      ? (json as { terms: unknown[] }).terms
      : []

  const seen = new Set<string>()
  const terms: TermInsight[] = []

  for (const item of items) {
    const result = termInsightSchema.safeParse(item)
    if (!result.success) continue

    const key = result.data.term.toLowerCase()
    if (seen.has(key)) continue
    seen.add(key)
    terms.push(result.data)

    if (terms.length >= MAX_TERMS_PER_PAGE) break
  }

  return terms
}
