import type { LangCodeISO6393 } from "@read-frog/definitions"
import type { CachedWebPageContext } from "./webpage-context"
import type { GlossaryMatcher } from "@/utils/glossary/types"
import type { PromptableProviderRef } from "@/utils/providers/provider-ref"
import { logger } from "@/utils/logger"
import { getProviderCacheIdentity } from "@/utils/providers/provider-ref"
import { createTermInsightMatcher, TERM_INSIGHT_TARGET_LANG } from "@/utils/term-insight/to-glossary"
import { getOrGenerateWebPageTerms } from "./webpage-terms"

/**
 * How long one paragraph waits for the term pass before translating without it.
 *
 * The pass is a model call over the whole page. A slow or wedged provider must
 * cost the first paragraphs a moment, not the whole translation; the call keeps
 * running, so every paragraph after it lands gets the terms.
 */
export const PAGE_TERMS_WAIT_MS = 15_000

/** How long a failed pass is remembered before the next paragraph may retry it. */
export const PAGE_TERMS_RETRY_AFTER_MS = 60_000

interface MemoEntry {
  key: string
  /** `null` when the pass failed, timed out upstream, or found no usable terms. */
  matcher: Promise<GlossaryMatcher | null>
  /** Set when the pass settled with no answer, to time the retry window. */
  failedAt: number | null
}

let memo: MemoEntry | null = null

// This runs once per paragraph. Without a page-level memo every paragraph would
// pay a message round trip, a cache read and a matcher compile. The key carries
// everything that makes the answer differ.
function memoKey(
  context: CachedWebPageContext,
  providerRef: PromptableProviderRef,
  targetLang: LangCodeISO6393,
): string {
  return [
    context.url,
    context.webTitle,
    String(context.webContent.length),
    getProviderCacheIdentity(providerRef),
    targetLang,
  ].join("|")
}

function startPass(
  context: CachedWebPageContext,
  providerRef: PromptableProviderRef,
  targetLang: LangCodeISO6393,
  key: string,
): MemoEntry {
  const entry: MemoEntry = {
    key,
    failedAt: null,
    matcher: getOrGenerateWebPageTerms(context, providerRef).then(
      (terms) => {
        if (terms === null) {
          entry.failedAt = Date.now()
          return null
        }
        const matcher = createTermInsightMatcher(terms, targetLang)
        return matcher.size === 0 ? null : matcher
      },
      (error) => {
        // Never worth failing a translation over; the page translates without.
        logger.warn("Page term pass failed", error)
        entry.failedAt = Date.now()
        return null
      },
    ),
  }
  return entry
}

/**
 * The matcher over the page's discovered terms, or `null` when there is none yet.
 *
 * `null` is always safe to pass on: the caller then builds exactly the prompt it
 * built before this feature existed.
 */
export async function getPageTermsMatcher(args: {
  context: CachedWebPageContext | null
  providerRef: PromptableProviderRef
  targetLang: LangCodeISO6393
  waitMs?: number
}): Promise<GlossaryMatcher | null> {
  const { context, providerRef, targetLang, waitMs = PAGE_TERMS_WAIT_MS } = args
  if (targetLang !== TERM_INSIGHT_TARGET_LANG || !context || !context.webContent.trim()) {
    return null
  }

  const key = memoKey(context, providerRef, targetLang)
  const retryable =
    memo?.key === key &&
    memo.failedAt !== null &&
    Date.now() - memo.failedAt >= PAGE_TERMS_RETRY_AFTER_MS
  if (memo === null || memo.key !== key || retryable) {
    memo = startPass(context, providerRef, targetLang, key)
  }

  return await Promise.race([
    memo.matcher,
    new Promise<null>((resolve) => setTimeout(() => resolve(null), waitMs)),
  ])
}

/** Test seam: forget the remembered pass. */
export function resetPageTermsMemo(): void {
  memo = null
}
