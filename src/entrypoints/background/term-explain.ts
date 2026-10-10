import type { ProviderRequestRouting } from "@/types/hosted-request"
import type { PromptableProviderRef } from "@/utils/providers/provider-ref"
import type { RequestQueue } from "@/utils/request/request-queue"
import type { TermExplanation, TermInsight } from "@/utils/term-insight/types"
import { getRandomUUID } from "@/utils/crypto-polyfill"
import { db } from "@/utils/db/dexie/db"
import { Sha256Hex } from "@/utils/hash"
import { validateProviderHostedFeature } from "@/utils/hosted-ai/routing"
import { logger } from "@/utils/logger"
import { getProviderCacheIdentity } from "@/utils/providers/provider-ref"
import { explainSelectedText, normalizeExplainText } from "@/utils/term-insight/explain"
import { findTermInsight } from "@/utils/term-insight/lookup"
import { generateTextForProviderRef } from "./background-stream"
import { buildTermInsightCacheKey } from "./term-insight"

const MEMORY_CACHE_LIMIT = 200
/** Answers of this worker's lifetime; the page pass is the persistent cache. */
const memoryCache = new Map<string, TermInsight>()

function remember(key: string, insight: TermInsight) {
  if (memoryCache.size >= MEMORY_CACHE_LIMIT) {
    const oldest = memoryCache.keys().next().value
    if (oldest !== undefined) {
      memoryCache.delete(oldest)
    }
  }
  memoryCache.set(key, insight)
}

/** Test seam. */
export function resetTermExplanationMemory() {
  memoryCache.clear()
}

/**
 * Explain the reader's selection. Order: the page's own term pass (free, and
 * consistent with the page translation), then this worker's memory, then one
 * model call.
 */
export async function getTermExplanation(
  args: ProviderRequestRouting<PromptableProviderRef> & {
    text: string
    context: string
    webTitle: string
    webContent: string
    requestQueue: RequestQueue
  },
): Promise<TermExplanation | null> {
  const { providerRef, hostedFeature, requestQueue } = args
  validateProviderHostedFeature(providerRef, hostedFeature)
  const routing: ProviderRequestRouting<PromptableProviderRef> =
    args.hostedFeature === undefined
      ? { providerRef: args.providerRef }
      : { providerRef: args.providerRef, hostedFeature: args.hostedFeature }

  const text = normalizeExplainText(args.text)
  if (!text) {
    return null
  }

  const pageKey = buildTermInsightCacheKey(args.webTitle, args.webContent, providerRef)
  if (pageKey) {
    const page = await db.termInsightCache.get(pageKey)
    const hit = page ? findTermInsight(page.terms, text) : undefined
    if (hit) {
      return { insight: hit, source: "page" }
    }
  }

  const memoryKey = Sha256Hex(
    getProviderCacheIdentity(providerRef),
    args.webTitle,
    text.toLowerCase(),
    // The sense of a word depends on its surroundings.
    Sha256Hex(args.context),
  )
  const remembered = memoryCache.get(memoryKey)
  if (remembered) {
    return { insight: remembered, source: "model" }
  }

  const hostedRequestId = providerRef.kind === "system" ? getRandomUUID() : undefined
  const thunk = async (signal?: AbortSignal) =>
    await explainSelectedText(
      { text, context: args.context, title: args.webTitle },
      routing,
      {
        signal,
        generate: (payload, runOptions) =>
          generateTextForProviderRef({ ...payload, requestId: hostedRequestId }, runOptions),
      },
    )

  try {
    const insight = await requestQueue.enqueue(thunk, Date.now(), `explain:${memoryKey}`)
    if (!insight) {
      return null
    }
    remember(memoryKey, insight)
    return { insight, source: "model" }
  } catch (error) {
    logger.warn("Failed to explain selected text:", error)
    return null
  }
}
