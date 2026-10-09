import type { MatchedTerm } from "@/utils/glossary/types"
import type { TermInsight } from "../types"
import { describe, expect, it } from "vitest"
import { buildMatchKey } from "@/utils/glossary/match-key"
import {
  createTermInsightMatcher,
  mergeDiscoveredTerms,
  termInsightsToGlossaryEntries,
} from "../to-glossary"

function insight(term: string, fa: string, extra: Partial<TermInsight> = {}): TermInsight {
  return {
    term,
    en: term,
    fa,
    meaningEn: "An English explanation.",
    meaningFa: "توضیح فارسی.",
    confidence: "high",
    ...extra,
  }
}

function matched(source: string, target: string): MatchedTerm {
  return {
    matchKey: buildMatchKey(source, false),
    source,
    target,
    keepOriginal: target === "",
  }
}

describe("termInsightsToGlossaryEntries", () => {
  it("only produces entries for Persian", () => {
    const terms = [insight("LLM", "مدل زبانی بزرگ")]
    expect(termInsightsToGlossaryEntries(terms, "eng")).toEqual([])
    expect(termInsightsToGlossaryEntries(terms, "pes")).toHaveLength(1)
  })

  it("does not enforce terms the model is unsure about", () => {
    const terms = [
      insight("LLM", "مدل زبانی بزرگ"),
      insight("Foo", "فو", { confidence: "low" }),
    ]
    const entries = termInsightsToGlossaryEntries(terms, "pes")
    expect(entries.map((entry) => entry.source)).toEqual(["LLM"])
  })

  it("matches acronyms and camel-case terms case-sensitively, plain words not", () => {
    const entries = termInsightsToGlossaryEntries(
      [
        insight("LLM", "مدل زبانی بزرگ"),
        insight("GitHub", "گیت‌هاب"),
        insight("machine learning", "یادگیری ماشین"),
        insight("Kubernetes", "کوبرنتیس"),
      ],
      "pes",
    )
    const bySource = Object.fromEntries(entries.map((entry) => [entry.source, entry.caseSensitive]))
    expect(bySource).toEqual({
      LLM: true,
      GitHub: true,
      "machine learning": false,
      Kubernetes: false,
    })
  })

  it("turns a rendering identical to the source into keep-original", () => {
    const [entry] = termInsightsToGlossaryEntries([insight("API", "API")], "pes")
    expect(entry!.target).toBe("")
  })

  it("uses the same match key as the user glossary", () => {
    const [entry] = termInsightsToGlossaryEntries(
      [insight("machine learning", "یادگیری ماشین")],
      "pes",
    )
    expect(entry!.matchKey).toBe(buildMatchKey("machine learning", false))
  })

  it("skips entries with an empty source or an empty Persian rendering", () => {
    const entries = termInsightsToGlossaryEntries(
      [insight("  ", "x"), insight("RAG", "  ")],
      "pes",
    )
    expect(entries).toEqual([])
  })
})

describe("createTermInsightMatcher", () => {
  const matcher = createTermInsightMatcher(
    [insight("LLM", "مدل زبانی بزرگ"), insight("machine learning", "یادگیری ماشین")],
    "pes",
  )

  it("finds the terms that occur in a paragraph, with their Persian wording", () => {
    const result = matcher.match("An LLM uses Machine Learning at scale.")
    expect(result.map((term) => [term.source, term.target])).toEqual([
      ["LLM", "مدل زبانی بزرگ"],
      ["machine learning", "یادگیری ماشین"],
    ])
  })

  it("does not hit an acronym inside another word or in the wrong case", () => {
    expect(matcher.match("The llm is lowercase, and LLMs is longer.")).toEqual([])
  })

  it("is empty for a non-Persian target", () => {
    expect(createTermInsightMatcher([insight("LLM", "x")], "eng").size).toBe(0)
  })
})

describe("mergeDiscoveredTerms", () => {
  it("returns the user's terms untouched when nothing was discovered", () => {
    const user = [matched("RAG", "بازیابی")]
    expect(mergeDiscoveredTerms(user, [])).toBe(user)
  })

  it("returns the user's terms untouched when every discovered term is already theirs", () => {
    const user = [matched("RAG", "بازیابی")]
    expect(mergeDiscoveredTerms(user, [matched("RAG", "چیز دیگر")])).toBe(user)
  })

  it("lets the user's wording win on the same term", () => {
    const merged = mergeDiscoveredTerms(
      [matched("RAG", "بازیابی")],
      [matched("RAG", "چیز دیگر"), matched("LLM", "مدل زبانی بزرگ")],
    )
    expect(merged.map((term) => [term.source, term.target])).toEqual([
      ["RAG", "بازیابی"],
      ["LLM", "مدل زبانی بزرگ"],
    ])
  })

  it("adds discovered terms when the user has none", () => {
    const merged = mergeDiscoveredTerms([], [matched("LLM", "مدل زبانی بزرگ")])
    expect(merged).toHaveLength(1)
  })
})
