import type { TermInsight } from "./types"
import type { BackgroundGenerateTextPayload } from "@/types/background-generate-text"
import type { ProviderRequestRouting } from "@/types/hosted-request"
import type { PromptableProviderRef } from "@/utils/providers/provider-ref"
import { cleanText } from "@/utils/content/utils"
import { logger } from "@/utils/logger"
import { getTermInsightPrompt } from "@/utils/prompts/term-insight"
import { parseTermInsights } from "./parse"

/** More than the summary's 3000: terms are spread over the whole article. */
export const TERM_INSIGHT_MAX_TEXT_LENGTH = 6000

const MAX_TITLE_LENGTH = 200

/**
 * Ask the model for the page's specialized terms. Returns `null` when there is
 * nothing to send or the call fails, and `[]` when the page has no terms.
 *
 * Mirrors `generateArticleSummary`: the caller supplies `generate`, which picks
 * the local or hosted route.
 */
export async function extractTermInsights(
  title: string,
  textContent: string,
  routing: ProviderRequestRouting<PromptableProviderRef>,
  options: {
    signal?: AbortSignal
    generate: (
      payload: BackgroundGenerateTextPayload,
      runOptions: { signal?: AbortSignal },
    ) => Promise<string>
  },
): Promise<TermInsight[] | null> {
  const preparedText = cleanText(textContent, TERM_INSIGHT_MAX_TEXT_LENGTH)
  if (!preparedText) {
    return null
  }

  try {
    const { systemPrompt, prompt } = getTermInsightPrompt(
      cleanText(title, MAX_TITLE_LENGTH),
      preparedText,
    )

    const payload: BackgroundGenerateTextPayload =
      routing.hostedFeature === undefined
        ? { providerRef: routing.providerRef, instructions: systemPrompt, prompt }
        : {
            providerRef: routing.providerRef,
            hostedFeature: routing.hostedFeature,
            instructions: systemPrompt,
            prompt,
          }

    const raw = await options.generate(payload, { signal: options.signal })
    const terms = parseTermInsights(raw)
    logger.info(`Extracted ${terms.length} terms`)
    return terms
  } catch (error) {
    logger.error("Failed to extract term insights:", error)
    return null
  }
}
