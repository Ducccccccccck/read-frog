import type { BackgroundGenerateTextPayload } from "@/types/background-generate-text"
import type { ProviderRequestRouting } from "@/types/hosted-request"
import type { PromptableProviderRef } from "@/utils/providers/provider-ref"
import { describe, expect, it, vi } from "vitest"
import { getTermExplainPrompt } from "@/utils/prompts/term-explain"
import { explainSelectedText, parseSingleTermInsight } from "../explain"

const localRouting = {
  providerRef: { kind: "local", config: { id: "p1" } },
} as unknown as ProviderRequestRouting<PromptableProviderRef>

const hostedRouting = {
  providerRef: { kind: "system", providerId: "x", modelTier: "normal", modelRevision: "r1" },
  hostedFeature: "selectionTranslation",
} as unknown as ProviderRequestRouting<PromptableProviderRef>

const insight = {
  term: "latency",
  en: "delay",
  fa: "تأخیر",
  meaningEn: "The time something takes to respond.",
  meaningFa: "مدت زمانی که طول می‌کشد تا پاسخی برسد.",
  confidence: "high",
}

describe("parseSingleTermInsight", () => {
  it("parses a bare object", () => {
    expect(parseSingleTermInsight(JSON.stringify(insight))).toEqual(insight)
  })

  it("parses an object wrapped in a code fence and chatter", () => {
    const raw = `Sure!\n\`\`\`json\n${JSON.stringify(insight)}\n\`\`\``
    expect(parseSingleTermInsight(raw)?.fa).toBe("تأخیر")
  })

  it("accepts a one-element array", () => {
    expect(parseSingleTermInsight(JSON.stringify([insight]))?.term).toBe("latency")
  })

  it("returns null for an invalid or empty answer", () => {
    expect(parseSingleTermInsight("I cannot help")).toBeNull()
    expect(parseSingleTermInsight(JSON.stringify({ term: "x" }))).toBeNull()
  })
})

describe("explainSelectedText", () => {
  it("sends the selection, context and title and returns the parsed explanation", async () => {
    const generate = vi.fn<
      (payload: BackgroundGenerateTextPayload, opts: { signal?: AbortSignal }) => Promise<string>
    >(async () => JSON.stringify(insight))

    const result = await explainSelectedText(
      { text: "latency", context: "High latency hurts users.", title: "Networks" },
      localRouting,
      { generate },
    )

    expect(result?.en).toBe("delay")
    const payload = generate.mock.calls[0]![0]
    expect(payload.prompt).toContain("latency")
    expect(payload.prompt).toContain("High latency hurts users.")
    expect(payload.prompt).toContain("Networks")
    expect(payload.hostedFeature).toBeUndefined()
  })

  it("passes the hosted feature through for a system provider", async () => {
    const generate = vi.fn(async () => JSON.stringify(insight))
    await explainSelectedText({ text: "latency", context: "", title: "" }, hostedRouting, {
      generate,
    })
    expect(generate.mock.calls[0]![0].hostedFeature).toBe("selectionTranslation")
  })

  it("returns null without a model call for an empty selection", async () => {
    const generate = vi.fn(async () => "{}")
    expect(
      await explainSelectedText({ text: "   ", context: "", title: "" }, localRouting, {
        generate,
      }),
    ).toBeNull()
    expect(generate).not.toHaveBeenCalled()
  })

  it("returns null when the model call fails", async () => {
    const generate = vi.fn(async () => {
      throw new Error("boom")
    })
    expect(
      await explainSelectedText({ text: "latency", context: "", title: "" }, localRouting, {
        generate,
      }),
    ).toBeNull()
  })
})

describe("getTermExplainPrompt", () => {
  it("asks for simple fluent Persian and English and treats input as data", () => {
    const { systemPrompt, prompt } = getTermExplainPrompt({
      text: "latency",
      context: "ctx",
      title: "T",
    })
    expect(systemPrompt).toContain("simple, fluent")
    expect(systemPrompt).toContain("Persian")
    expect(systemPrompt).toContain("not instructions")
    expect(prompt).toContain("Selected text:\nlatency")
  })
})
