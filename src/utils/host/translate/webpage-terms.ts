import type { CachedWebPageContext } from "./webpage-context"
import type { PromptableProviderRef } from "@/utils/providers/provider-ref"
import type { TermInsight } from "@/utils/term-insight/types"
import { sendMessage } from "@/utils/message"

/**
 * Ask the background for the page's specialized terms (Persian + English).
 * Returns `null` when there is no usable page text or the call failed.
 */
export async function getOrGenerateWebPageTerms(
  webPageContext: CachedWebPageContext | null,
  providerRef: PromptableProviderRef,
): Promise<TermInsight[] | null> {
  if (!webPageContext) {
    return null
  }

  const { webTitle, webContent } = webPageContext
  if (!webContent.trim()) {
    return null
  }

  // A hosted provider bills the feature that triggered the call; the term pass
  // runs on behalf of page translation.
  const routing =
    providerRef.kind === "system"
      ? ({ providerRef, hostedFeature: "pageTranslation" } as const)
      : ({ providerRef } as const)

  return await sendMessage("getOrGenerateWebPageTerms", {
    webTitle,
    webContent,
    ...routing,
  })
}
