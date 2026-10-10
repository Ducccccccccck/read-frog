import type { TermInsight } from "../types"
import { describe, expect, it } from "vitest"
import { findTermInsight } from "../lookup"

function term(name: string): TermInsight {
  return {
    term: name,
    en: name,
    fa: "فا",
    meaningEn: "m",
    meaningFa: "م",
    confidence: "high",
  }
}

describe("findTermInsight", () => {
  const terms = [term("LLM"), term("Large Language Model")]

  it("matches ignoring case", () => {
    expect(findTermInsight(terms, "llm")?.term).toBe("LLM")
  })

  it("ignores surrounding punctuation and quotes", () => {
    expect(findTermInsight(terms, "“LLM”,")?.term).toBe("LLM")
    expect(findTermInsight(terms, " (large language model). ")?.term).toBe("Large Language Model")
  })

  it("returns undefined for a term the page pass did not cover", () => {
    expect(findTermInsight(terms, "transformer")).toBeUndefined()
    expect(findTermInsight(terms, "  ")).toBeUndefined()
  })
})
