import type { TermInsight } from "./types"
import type { BackgroundGenerateTextPayload } from "@/types/background-generate-text"
import type { ProviderRequestRouting } from "@/types/hosted-request"
import type { PromptableProviderRef } from "@/utils/providers/provider-ref"
import { cleanText } from "@/utils/content/utils"
import { logger } from "@/utils/logger"
import {
  getTermExplainPrompt,
  TERM_EXPLAIN_MAX_CONTEXT_LENGTH,
  TERM_EXPLAIN_MAX_TEXT_LENGTH,
} from "@/utils/prompts/term-explain"
import { parseTermInsights } from "./parse"

const MAX_TITLE_LENGTH = 200

/** Collapse whitespace and cap the length; the card key and the prompt use this form. */
export function normalizeExplainText(text: string): string {
  return cleanText(text, TERM_EXPLAIN_MAX_TEXT_LENGTH)
}

/**
 * Ask the model to explain one selected word, term or phrase in simple,
 * fluent Persian and English. Returns `null` on failure or empty input.
 */
export async function explainSelectedText(
  args: { text: string; context: string; title: string },
  routing: ProviderRequestRouting<PromptableProviderRef>,
  options: {
    signal?: AbortSignal
    generate: (
      payload: BackgroundGenerateTextPayload,
      runOptions: { signal?: AbortSignal },
    ) => Promise<string>
  },
): Promise<TermInsight | null> {
  const text = normalizeExplainText(args.text)
  if (!text) {
    return null
  }

  try {
    const { systemPrompt, prompt } = getTermExplainPrompt({
      text,
      context: cleanText(args.context, TERM_EXPLAIN_MAX_CONTEXT_LENGTH),
      title: cleanText(args.title, MAX_TITLE_LENGTH),
    })

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
    return parseSingleTermInsight(raw)
  } catch (error) {
    logger.error("Failed to explain selected text:", error)
    return null
  }
}

/** The model is asked for one object; a one-element array is accepted too. */
export function parseSingleTermInsight(raw: string): TermInsight | null {
  const trimmed = raw.trim()
  const start = trimmed.indexOf("{")
  const end = trimmed.lastIndexOf("}")
  if (start === -1 || end <= start) {
    return null
  }
  // Reuse the tolerant list parser by wrapping the object in an array.
  const [first] = parseTermInsights(`[${trimmed.slice(start, end + 1)}]`)
  return first ?? null
}
