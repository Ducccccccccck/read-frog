import type { LangCodeISO6393 } from "@read-frog/definitions"
import type { GlossaryEntry, GlossaryMatcher, MatchedTerm } from "@/utils/glossary/types"
import type { TermInsight } from "./types"
import { buildMatchKey } from "@/utils/glossary/match-key"
import { createGlossaryMatcher } from "@/utils/glossary/matcher"

/**
 * Persian is the only target whose terms are forced into the translation.
 *
 * English output is left alone: an English "translation" of an English term is
 * the term itself, so there is nothing to enforce. Other targets have no
 * explanation column in the term pass at all.
 */
export const TERM_INSIGHT_TARGET_LANG: LangCodeISO6393 = "pes"

/**
 * `LLM`, `iOS`, `GitHub` are case-sensitive on purpose: matching them
 * case-insensitively would also hit `llm` or `ios` inside ordinary words.
 * Plain lowercase terms ("machine learning") and capitalised words
 * ("Kubernetes") stay case-insensitive.
 */
function isCaseSensitive(term: string): boolean {
  return /[A-Z]/.test(term.slice(1))
}

/**
 * The glossary entries that the discovered terms stand for, for one target.
 *
 * Only high-confidence terms are enforced: a term the model is unsure about
 * must not be forced onto every paragraph of the page, where a wrong wording
 * would be repeated and then cached. `low` terms still reach the explanation
 * card, which is where uncertainty is shown rather than hidden.
 *
 * A Persian rendering identical to the source (an acronym kept as written)
 * becomes a keep-original entry, the same representation the user glossary
 * uses for "do not translate".
 */
export function termInsightsToGlossaryEntries(
  terms: readonly TermInsight[],
  targetLang: LangCodeISO6393,
): GlossaryEntry[] {
  if (targetLang !== TERM_INSIGHT_TARGET_LANG) return []

  const entries: GlossaryEntry[] = []
  for (const term of terms) {
    if (term.confidence !== "high") continue

    const source = term.term.trim()
    const target = term.fa.trim()
    if (source === "" || target === "") continue

    const caseSensitive = isCaseSensitive(source)
    entries.push({
      matchKey: buildMatchKey(source, caseSensitive),
      source,
      target: target === source ? "" : target,
      caseSensitive,
    })
  }
  return entries
}

export function createTermInsightMatcher(
  terms: readonly TermInsight[],
  targetLang: LangCodeISO6393,
): GlossaryMatcher {
  return createGlossaryMatcher(termInsightsToGlossaryEntries(terms, targetLang))
}

/**
 * The terms a request carries: the user's glossary plus the ones discovered on
 * the page.
 *
 * The user's entry wins on the same `matchKey`, because a wording the user wrote
 * down is a decision and a discovered one is a guess. The result is
 * `userTerms` untouched when nothing was discovered, so a page without
 * discovered terms produces a byte-identical prompt, and therefore the same
 * translation cache key, as before this feature existed.
 */
export function mergeDiscoveredTerms(
  userTerms: MatchedTerm[],
  discoveredTerms: readonly MatchedTerm[],
): MatchedTerm[] {
  if (discoveredTerms.length === 0) return userTerms

  const taken = new Set(userTerms.map((term) => term.matchKey))
  const extra = discoveredTerms.filter((term) => !taken.has(term.matchKey))
  if (extra.length === 0) return userTerms

  return [...userTerms, ...extra]
}
