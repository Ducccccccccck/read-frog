import type { CachedWebPageContext } from "../webpage-context"
import type { PromptableProviderRef } from "@/utils/providers/provider-ref"
import type { TermInsight } from "@/utils/term-insight/types"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

const { getTermsMock } = vi.hoisted(() => ({
  getTermsMock: vi.fn<(context: unknown, providerRef: unknown) => Promise<TermInsight[] | null>>(),
}))

vi.mock("../webpage-terms", () => ({ getOrGenerateWebPageTerms: getTermsMock }))
vi.mock("@/utils/providers/provider-ref", () => ({
  getProviderCacheIdentity: (ref: unknown) => JSON.stringify(ref),
}))

const providerRef = { kind: "local", config: { id: "p1" } } as unknown as PromptableProviderRef

function context(overrides: Partial<CachedWebPageContext> = {}): CachedWebPageContext {
  return {
    url: "https://example.test/a",
    webTitle: "Title",
    webContent: "An article about LLM systems.",
    ...overrides,
  }
}

const llm: TermInsight = {
  term: "LLM",
  en: "Large Language Model",
  fa: "مدل زبانی بزرگ",
  meaningEn: "A model trained on text.",
  meaningFa: "مدلی که روی متن آموزش دیده است.",
  confidence: "high",
}

async function load() {
  return await import("../page-terms")
}

describe("getPageTermsMatcher", () => {
  beforeEach(async () => {
    vi.resetAllMocks()
    const { resetPageTermsMemo } = await load()
    resetPageTermsMemo()
  })

  afterEach(() => vi.useRealTimers())

  it("does not call the model for a non-Persian target or an empty page", async () => {
    const { getPageTermsMatcher } = await load()

    expect(
      await getPageTermsMatcher({ context: context(), providerRef, targetLang: "eng" }),
    ).toBeNull()
    expect(
      await getPageTermsMatcher({
        context: context({ webContent: "   " }),
        providerRef,
        targetLang: "pes",
      }),
    ).toBeNull()
    expect(await getPageTermsMatcher({ context: null, providerRef, targetLang: "pes" })).toBeNull()
    expect(getTermsMock).not.toHaveBeenCalled()
  })

  it("runs one pass per page however many paragraphs ask", async () => {
    getTermsMock.mockResolvedValue([llm])
    const { getPageTermsMatcher } = await load()

    const results = await Promise.all([
      getPageTermsMatcher({ context: context(), providerRef, targetLang: "pes" }),
      getPageTermsMatcher({ context: context(), providerRef, targetLang: "pes" }),
      getPageTermsMatcher({ context: context(), providerRef, targetLang: "pes" }),
    ])

    expect(getTermsMock).toHaveBeenCalledTimes(1)
    expect(results[0]!.match("An LLM here.")[0]!.target).toBe("مدل زبانی بزرگ")
    // Same compiled matcher for every paragraph.
    expect(results[1]).toBe(results[0])
  })

  it("starts a new pass for another page", async () => {
    getTermsMock.mockResolvedValue([llm])
    const { getPageTermsMatcher } = await load()

    await getPageTermsMatcher({ context: context(), providerRef, targetLang: "pes" })
    await getPageTermsMatcher({
      context: context({ url: "https://example.test/b" }),
      providerRef,
      targetLang: "pes",
    })

    expect(getTermsMock).toHaveBeenCalledTimes(2)
  })

  it("returns null when the page has no usable terms", async () => {
    getTermsMock.mockResolvedValue([])
    const { getPageTermsMatcher } = await load()
    expect(
      await getPageTermsMatcher({ context: context(), providerRef, targetLang: "pes" }),
    ).toBeNull()
  })

  it("returns null when the pass fails, then retries only after the cool-down", async () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date("2026-10-09T10:00:00.000Z"))
    getTermsMock.mockResolvedValueOnce(null).mockResolvedValue([llm])
    const { getPageTermsMatcher, PAGE_TERMS_RETRY_AFTER_MS } = await load()
    const args = { context: context(), providerRef, targetLang: "pes" } as const

    expect(await getPageTermsMatcher(args)).toBeNull()
    expect(await getPageTermsMatcher(args)).toBeNull()
    expect(getTermsMock).toHaveBeenCalledTimes(1)

    vi.setSystemTime(Date.now() + PAGE_TERMS_RETRY_AFTER_MS + 1)
    const retried = await getPageTermsMatcher(args)
    expect(getTermsMock).toHaveBeenCalledTimes(2)
    expect(retried).not.toBeNull()
  })

  it("treats a rejected pass as no answer", async () => {
    getTermsMock.mockRejectedValue(new Error("boom"))
    const { getPageTermsMatcher } = await load()
    expect(
      await getPageTermsMatcher({ context: context(), providerRef, targetLang: "pes" }),
    ).toBeNull()
  })

  it("stops waiting after the limit but lets later paragraphs use the answer", async () => {
    let resolvePass!: (terms: TermInsight[]) => void
    getTermsMock.mockReturnValue(
      new Promise<TermInsight[]>((resolve) => {
        resolvePass = resolve
      }),
    )
    const { getPageTermsMatcher } = await load()
    const args = { context: context(), providerRef, targetLang: "pes", waitMs: 5 } as const

    expect(await getPageTermsMatcher(args)).toBeNull()

    resolvePass([llm])
    const later = await getPageTermsMatcher(args)
    expect(getTermsMock).toHaveBeenCalledTimes(1)
    expect(later).not.toBeNull()
  })
})
