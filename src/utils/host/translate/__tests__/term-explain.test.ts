import type { Config } from "@/types/config/config"
import { beforeEach, describe, expect, it, vi } from "vitest"

const { getLocalConfigMock, sendMessageMock, resolveRefMock, pageProviderMock, selectionProviderMock } =
  vi.hoisted(() => ({
    getLocalConfigMock: vi.fn(),
    sendMessageMock: vi.fn(),
    resolveRefMock: vi.fn(),
    pageProviderMock: vi.fn(),
    selectionProviderMock: vi.fn(),
  }))

vi.mock("@/utils/config/storage", () => ({ getLocalConfig: getLocalConfigMock }))
vi.mock("@/utils/message", () => ({ sendMessage: sendMessageMock }))
vi.mock("@/utils/logger", () => ({
  logger: { warn: vi.fn(), error: vi.fn(), info: vi.fn() },
}))
vi.mock("../translate-text", () => ({ resolvePageProviderRef: resolveRefMock }))
vi.mock("../webpage-context", () => ({
  getOrCreateWebPageContext: async () => ({ url: "u", webTitle: "Title", webContent: "Body" }),
}))
vi.mock("@/utils/providers/provider-ref", () => ({
  resolvePageTranslationProviderOrNull: pageProviderMock,
  canResolvedProviderRefGenerateText: (ref: { llm?: boolean }) => ref.llm === true,
}))
vi.mock("@/utils/providers/provider-registry", () => ({
  resolveProviderRefForCapability: selectionProviderMock,
}))

const config = {
  providersConfig: [],
  selectionToolbar: { features: { translate: { providerId: "sel" } } },
} as unknown as Config

describe("explainSelectedTerm", () => {
  beforeEach(() => {
    vi.resetAllMocks()
    getLocalConfigMock.mockResolvedValue(config)
  })

  it("reports no-provider when only plain translators are configured", async () => {
    pageProviderMock.mockReturnValue({ kind: "local", llm: false })
    selectionProviderMock.mockReturnValue({ kind: "local", llm: false })
    const { explainSelectedTerm } = await import("../term-explain")

    expect(await explainSelectedTerm("latency", "ctx")).toEqual({ status: "no-provider" })
    expect(sendMessageMock).not.toHaveBeenCalled()
  })

  it("prefers the page-translation provider and sends the page context", async () => {
    pageProviderMock.mockReturnValue({ kind: "local", llm: true })
    selectionProviderMock.mockReturnValue({ kind: "local", llm: true })
    resolveRefMock.mockResolvedValue({ kind: "local", config: { id: "page" } })
    sendMessageMock.mockResolvedValue({ insight: { term: "x" }, source: "page" })
    const { explainSelectedTerm } = await import("../term-explain")

    const result = await explainSelectedTerm("latency", "ctx")

    expect(result.status).toBe("ok")
    const [name, data] = sendMessageMock.mock.calls[0]!
    expect(name).toBe("explainSelectedTerm")
    expect(data).toMatchObject({
      text: "latency",
      context: "ctx",
      webTitle: "Title",
      webContent: "Body",
      providerRef: { kind: "local", config: { id: "page" } },
    })
    expect(data.hostedFeature).toBeUndefined()
  })

  it("falls back to the selection provider and bills hosted calls to selection translation", async () => {
    pageProviderMock.mockReturnValue(null)
    selectionProviderMock.mockReturnValue({ kind: "system", llm: true })
    resolveRefMock.mockResolvedValue({ kind: "system", providerId: "x" })
    sendMessageMock.mockResolvedValue({ insight: { term: "x" }, source: "model" })
    const { explainSelectedTerm } = await import("../term-explain")

    await explainSelectedTerm("latency", "ctx")

    expect(resolveRefMock).toHaveBeenCalledWith(
      expect.objectContaining({ kind: "system" }),
      undefined,
      "selectionTranslation",
    )
    expect(sendMessageMock.mock.calls[0]![1].hostedFeature).toBe("selectionTranslation")
  })

  it("reports failed when the background has no answer or throws", async () => {
    pageProviderMock.mockReturnValue({ kind: "local", llm: true })
    resolveRefMock.mockResolvedValue({ kind: "local", config: {} })
    const { explainSelectedTerm } = await import("../term-explain")

    sendMessageMock.mockResolvedValueOnce(null)
    expect(await explainSelectedTerm("a", "b")).toEqual({ status: "failed" })

    sendMessageMock.mockRejectedValueOnce(new Error("boom"))
    expect(await explainSelectedTerm("a", "b")).toEqual({ status: "failed" })
  })
})
