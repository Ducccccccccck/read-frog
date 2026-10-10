import { z } from "zod"

/** Hard cap per page: the pass is one request, so its output must stay small. */
export const MAX_TERMS_PER_PAGE = 30

/** Bump when the prompt or the shape changes, so old cache entries are not reused. */
export const TERM_INSIGHT_VERSION = "1"

/**
 * One specialized term found on a page, explained in Persian and English.
 *
 * `confidence: "low"` marks a term the model is unsure about (new, niche, or
 * possibly outdated). A later step uses it to decide whether a web search is
 * worth its cost.
 */
export const termInsightSchema = z.object({
  /** Exactly as it appears in the page text. */
  term: z.string().trim().min(1).max(120),
  en: z.string().trim().min(1).max(200),
  fa: z.string().trim().min(1).max(200),
  meaningEn: z.string().trim().min(1).max(700),
  meaningFa: z.string().trim().min(1).max(700),
  confidence: z.enum(["high", "low"]).catch("high"),
})

export type TermInsight = z.infer<typeof termInsightSchema>

/** The explanation card's answer. "page": from the page's term pass, no model call. */
export interface TermExplanation {
  insight: TermInsight
  source: "page" | "model"
}
