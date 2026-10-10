import type { Config } from "@/types/config/config"
import type { PromptableProviderRef } from "@/utils/providers/provider-ref"
import type { TermExplanation } from "@/utils/term-insight/types"
import { getLocalConfig } from "@/utils/config/storage"
import { logger } from "@/utils/logger"
import { sendMessage } from "@/utils/message"
import {
  canResolvedProviderRefGenerateText,
  resolvePageTranslationProviderOrNull,
} from "@/utils/providers/provider-ref"
import { resolveProviderRefForCapability } from "@/utils/providers/provider-registry"
import { resolvePageProviderRef } from "./translate-text"
import { getOrCreateWebPageContext } from "./webpage-context"

export type TermExplainResult =
  | { status: "ok"; explanation: TermExplanation }
  /** No configured provider can write an explanation (only plain translators). */
  | { status: "no-provider" }
  | { status: "failed" }

/**
 * The model-capable provider for the card: the page-translation provider first
 * (it is also what the page term pass used, so the page's cached terms answer
 * the card for free), then the selection-translation provider.
 */
export function resolveTermExplainProvider(config: Config) {
  const candidates = [
    resolvePageTranslationProviderOrNull(config),
    resolveProviderRefForCapability(
      "selectionTranslation",
      config.providersConfig,
      config.selectionToolbar.features.translate.providerId,
    ),
  ]

  for (const candidate of candidates) {
    if (candidate && canResolvedProviderRefGenerateText(candidate)) {
      return candidate
    }
  }
  return null
}

/** Ask the background to explain `text` in simple Persian and English. */
export async function explainSelectedTerm(
  text: string,
  context: string,
): Promise<TermExplainResult> {
  try {
    const config = await getLocalConfig()
    const provider = config ? resolveTermExplainProvider(config) : null
    if (!provider) {
      return { status: "no-provider" }
    }

    const providerRef: PromptableProviderRef = await resolvePageProviderRef(
      provider,
      undefined,
      "selectionTranslation",
    )
    const routing =
      providerRef.kind === "system"
        ? ({ providerRef, hostedFeature: "selectionTranslation" } as const)
        : ({ providerRef } as const)

    // The page context identifies the page's cached term pass; it may be absent
    // (a blank page), in which case the card just asks the model.
    const page = await getOrCreateWebPageContext()

    const explanation = await sendMessage("explainSelectedTerm", {
      text,
      context,
      webTitle: page?.webTitle ?? document.title,
      webContent: page?.webContent ?? "",
      ...routing,
    })
    return explanation ? { status: "ok", explanation } : { status: "failed" }
  } catch (error) {
    logger.warn("Could not explain the selected term", error)
    return { status: "failed" }
  }
}
