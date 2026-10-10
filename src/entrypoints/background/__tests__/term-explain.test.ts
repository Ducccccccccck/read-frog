import type { PromptableProviderRef } from "@/utils/providers/provider-ref"
import type { RequestQueue } from "@/utils/request/request-queue"
import type { TermInsight } from "@/utils/term-insight/types"
import { beforeEach, describe, expect, it, vi } from "vitest"

const { dbGetMock, generateMock } = vi.hoisted(() => ({
  dbGetMock: vi.fn<(key: string) => Promise<{ terms: TermInsight[] } | undefined>>(),
  generateMock: vi.fn<(payload: unknown, opts: unknown) => Promise<string>>(),
}))

vi.mock("@/utils/db/dexie/db", () => ({ db: { termInsightCache: { get: dbGetMock } } }))
vi.mock("../background-stream", () => ({ generateTextForProviderRef: generateMock }))

const providerRef = { kind: "local", config: { id: "p1" } } as unknown as PromptableProviderRef

// Runs the task immediately, like a queue with no limits.
const requestQueue = {
  enqueue: async (thunk: (signal?: AbortSignal) => Promise<unknown>) => await thunk(),
} as unknown as RequestQueue

const pageTerm: TermInsight = {
  term: "LLM",
  en: "Large Language Model",
  fa: "مدل زبانی بزرگ",
  meaningEn: "A model trained on text.",
  meaningFa: "مدلی که روی متن آموزش دیده است.",
  confidence: "high",
}

const modelAnswer = JSON.stringify({
  term: "latency",
  en: "delay",
  fa: "تأخیر",
  meaningEn: "How long a response takes.",
  meaningFa: "مدت زمان رسیدن پاسخ.",
  confidence: "high",
})

function args(text: string) {
  return {
    providerRef,
    text,
    context: "Some context.",
    webTitle: "Page",
    webContent: "An article about LLM systems and latency.",
    requestQueue,
  }
}

describe("getTermExplanation", () => {
  beforeEach(async () => {
    dbGetMock.mockReset()
    generateMock.mockReset()
    const { resetTermExplanationMemory } = await import("../term-explain")
    resetTermExplanationMemory()
  })

  it("answers from the page's term pass without calling the model", async () => {
    dbGetMock.mockResolvedValue({ terms: [pageTerm] })
    const { getTermExplanation } = await import("../term-explain")

    const result = await getTermExplanation(args("llm"))

    expect(result).toEqual({ insight: pageTerm, source: "page" })
    expect(generateMock).not.toHaveBeenCalled()
  })

  it("asks the model when the page pass does not cover the text", async () => {
    dbGetMock.mockResolvedValue({ terms: [pageTerm] })
    generateMock.mockResolvedValue(modelAnswer)
    const { getTermExplanation } = await import("../term-explain")

    const result = await getTermExplanation(args("latency"))

    expect(result?.source).toBe("model")
    expect(result?.insight.fa).toBe("تأخیر")
    expect(generateMock).toHaveBeenCalledTimes(1)
  })

  it("remembers a model answer for the same word in the same context", async () => {
    dbGetMock.mockResolvedValue(undefined)
    generateMock.mockResolvedValue(modelAnswer)
    const { getTermExplanation } = await import("../term-explain")

    await getTermExplanation(args("latency"))
    const again = await getTermExplanation(args("Latency"))

    expect(again?.insight.en).toBe("delay")
    expect(generateMock).toHaveBeenCalledTimes(1)
  })

  it("returns null and does not remember a failed answer", async () => {
    dbGetMock.mockResolvedValue(undefined)
    generateMock.mockResolvedValue("not json")
    const { getTermExplanation } = await import("../term-explain")

    expect(await getTermExplanation(args("latency"))).toBeNull()

    generateMock.mockResolvedValue(modelAnswer)
    expect((await getTermExplanation(args("latency")))?.source).toBe("model")
    expect(generateMock).toHaveBeenCalledTimes(2)
  })

  it("returns null for an empty selection", async () => {
    const { getTermExplanation } = await import("../term-explain")
    expect(await getTermExplanation(args("  "))).toBeNull()
    expect(generateMock).not.toHaveBeenCalled()
  })
})
