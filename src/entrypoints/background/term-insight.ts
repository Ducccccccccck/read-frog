import type { ProviderRequestRouting } from "@/types/hosted-request"
import type { PromptableProviderRef } from "@/utils/providers/provider-ref"
import type { RequestQueue } from "@/utils/request/request-queue"
import type { TermInsight } from "@/utils/term-insight/types"
import { cleanText } from "@/utils/content/utils"
import { getRandomUUID } from "@/utils/crypto-polyfill"
import { db } from "@/utils/db/dexie/db"
import { Sha256Hex } from "@/utils/hash"
import { validateProviderHostedFeature } from "@/utils/hosted-ai/routing"
import { logger } from "@/utils/logger"
import { getProviderCacheIdentity } from "@/utils/providers/provider-ref"
import { extractTermInsights, TERM_INSIGHT_MAX_TEXT_LENGTH } from "@/utils/term-insight/extract"
import { TERM_INSIGHT_VERSION } from "@/utils/term-insight/types"
import { generateTextForProviderRef } from "./background-stream"

/** Cache key of a page's term pass; shared with the selection card's lookup. */
export function buildTermInsightCacheKey(
  title: string,
  textContent: string,
  providerRef: PromptableProviderRef,
): string | null {
  const preparedText = cleanText(textContent, TERM_INSIGHT_MAX_TEXT_LENGTH)
  if (!preparedText) {
    return null
  }
  return Sha256Hex(
    title,
    Sha256Hex(preparedText),
    getProviderCacheIdentity(providerRef),
    TERM_INSIGHT_VERSION,
  )
}

/**
 * Specialized terms of a page, explained in Persian and English. One model call
 * per page and provider, cached in IndexedDB: the same pattern as the page
 * summary (`translation-context-summary.ts`).
 */
export async function getOrGenerateTermInsights(
  args: ProviderRequestRouting<PromptableProviderRef> & {
    title: string
    textContent: string
    requestQueue: RequestQueue
  },
): Promise<TermInsight[] | null> {
  const { title, textContent, providerRef, hostedFeature, requestQueue } = args
  validateProviderHostedFeature(providerRef, hostedFeature)
  // Narrowed through `args`, not the destructured names: TypeScript only keeps
  // the discriminated union intact when the property is read off the object.
  const routing: ProviderRequestRouting<PromptableProviderRef> =
    args.hostedFeature === undefined
      ? { providerRef: args.providerRef }
      : { providerRef: args.providerRef, hostedFeature: args.hostedFeature }

  const cacheKey = buildTermInsightCacheKey(title, textContent, providerRef)
  if (!cacheKey) {
    return null
  }

  const cached = await db.termInsightCache.get(cacheKey)
  if (cached) {
    logger.info("Using cached term insights")
    return cached.terms
  }

  // Stable for this queue task: automatic retries must reuse the idempotency
  // key, because a lost hosted response may already have been billed.
  const hostedRequestId = providerRef.kind === "system" ? getRandomUUID() : undefined

  const thunk = async (signal?: AbortSignal) => {
    const cachedAgain = await db.termInsightCache.get(cacheKey)
    if (cachedAgain) {
      return cachedAgain.terms
    }

    const terms = await extractTermInsights(title, textContent, routing, {
      signal,
      generate: (payload, runOptions) =>
        generateTextForProviderRef({ ...payload, requestId: hostedRequestId }, runOptions),
    })
    // `null` is a failure and is not cached; `[]` is a real answer and is.
    if (terms === null) {
      return null
    }

    await db.termInsightCache.put({ key: cacheKey, terms, createdAt: new Date() })
    logger.info("Generated and cached new term insights")
    return terms
  }

  try {
    return await requestQueue.enqueue(thunk, Date.now(), cacheKey)
  } catch (error) {
    logger.warn("Failed to get/generate term insights:", error)
    return null
  }
}
