import { describe, expect, it } from "vitest"
import { parseTermInsights } from "../parse"
import { MAX_TERMS_PER_PAGE } from "../types"

function term(name: string, extra: Record<string, unknown> = {}) {
  return {
    term: name,
    en: `${name} (en)`,
    fa: `${name} (fa)`,
    meaningEn: "An English explanation.",
    meaningFa: "توضیح فارسی.",
    confidence: "high",
    ...extra,
  }
}

describe("parseTermInsights", () => {
  it("parses a bare JSON array", () => {
    const result = parseTermInsights(JSON.stringify([term("LLM"), term("RAG")]))
    expect(result.map((t) => t.term)).toEqual(["LLM", "RAG"])
  })

  it("accepts an object with a terms array", () => {
    const result = parseTermInsights(JSON.stringify({ terms: [term("LLM")] }))
    expect(result).toHaveLength(1)
  })

  it("strips a markdown code fence", () => {
    const raw = `\`\`\`json\n${JSON.stringify([term("LLM")])}\n\`\`\``
    expect(parseTermInsights(raw)).toHaveLength(1)
  })

  it("finds the array inside surrounding chatter", () => {
    const raw = `Here are the terms: ${JSON.stringify([term("LLM")])} Hope that helps!`
    expect(parseTermInsights(raw)).toHaveLength(1)
  })

  it("keeps valid items when another item is malformed", () => {
    const raw = JSON.stringify([term("LLM"), { term: "broken" }, "nonsense", term("RAG")])
    expect(parseTermInsights(raw).map((t) => t.term)).toEqual(["LLM", "RAG"])
  })

  it("drops case-insensitive duplicates and keeps the first", () => {
    const raw = JSON.stringify([term("LLM"), term("llm", { en: "second" })])
    const result = parseTermInsights(raw)
    expect(result).toHaveLength(1)
    expect(result[0]!.en).toBe("LLM (en)")
  })

  it("falls back to high confidence for an unknown value", () => {
    const result = parseTermInsights(JSON.stringify([term("LLM", { confidence: "maybe" })]))
    expect(result[0]!.confidence).toBe("high")
  })

  it("keeps low confidence", () => {
    const result = parseTermInsights(JSON.stringify([term("LLM", { confidence: "low" })]))
    expect(result[0]!.confidence).toBe("low")
  })

  it("caps the number of terms", () => {
    const many = Array.from({ length: MAX_TERMS_PER_PAGE + 10 }, (_, i) => term(`t${i}`))
    expect(parseTermInsights(JSON.stringify(many))).toHaveLength(MAX_TERMS_PER_PAGE)
  })

  it("returns an empty list for garbage and for an empty array", () => {
    expect(parseTermInsights("not json at all")).toEqual([])
    expect(parseTermInsights("[]")).toEqual([])
    expect(parseTermInsights("")).toEqual([])
  })
})
