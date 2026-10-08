import type { BackgroundGenerateTextPayload } from "@/types/background-generate-text"
import type { ProviderRequestRouting } from "@/types/hosted-request"
import type { PromptableProviderRef } from "@/utils/providers/provider-ref"
import { describe, expect, it, vi } from "vitest"
import { getTermInsightPrompt } from "@/utils/prompts/term-insight"
import { extractTermInsights } from "../extract"

const hostedRouting = {
  providerRef: {
    kind: "system",
    providerId: "test-provider",
    modelTier: "standard",
    modelRevision: "r1",
  },
  hostedFeature: "pageTranslation",
} as unknown as ProviderRequestRouting<PromptableProviderRef>

const answer = JSON.stringify([
  {
    term: "LLM",
    en: "Large Language Model",
    fa: "مدل زبانی بزرگ",
    meaningEn: "A model trained on large amounts of text.",
    meaningFa: "مدلی که روی حجم زیادی از متن آموزش دیده است.",
    confidence: "high",
  },
])

describe("extractTermInsights", () => {
  it("returns parsed terms and sends the title and page text to the model", async () => {
    const generate = vi.fn<
      (payload: BackgroundGenerateTextPayload, opts: { signal?: AbortSignal }) => Promise<string>
    >(async () => answer)

    const result = await extractTermInsights(
      "My title",
      "An article about LLM systems.",
      hostedRouting,
      { generate },
    )

    expect(result).toHaveLength(1)
    expect(result![0]!.fa).toBe("مدل زبانی بزرگ")
    const payload = generate.mock.calls[0]![0]
    expect(payload.prompt).toContain("My title")
    expect(payload.prompt).toContain("An article about LLM systems.")
    expect(payload.hostedFeature).toBe("pageTranslation")
  })

  it("returns null without calling the model when there is no text", async () => {
    const generate = vi.fn<() => Promise<string>>()
    const result = await extractTermInsights("t", "   ​  ", hostedRouting, { generate })
    expect(result).toBeNull()
    expect(generate).not.toHaveBeenCalled()
  })

  it("returns null when the model call fails", async () => {
    const generate = vi.fn<() => Promise<string>>(async () => {
      throw new Error("boom")
    })
    const result = await extractTermInsights("t", "some text", hostedRouting, { generate })
    expect(result).toBeNull()
  })

  it("returns an empty list when the model answers with no terms", async () => {
    const generate = vi.fn<() => Promise<string>>(async () => "[]")
    const result = await extractTermInsights("t", "some text", hostedRouting, { generate })
    expect(result).toEqual([])
  })
})

describe("getTermInsightPrompt", () => {
  it("keeps the page text in the user message, not the system message", () => {
    const { systemPrompt, prompt } = getTermInsightPrompt("Title", "UNIQUE-PAGE-TEXT")
    expect(prompt).toContain("UNIQUE-PAGE-TEXT")
    expect(systemPrompt).not.toContain("UNIQUE-PAGE-TEXT")
  })

  it("asks for both Persian and English and for JSON only", () => {
    const { systemPrompt } = getTermInsightPrompt("Title", "text")
    expect(systemPrompt).toContain("Persian")
    expect(systemPrompt).toContain("English")
    expect(systemPrompt).toContain("JSON array")
  })
})
