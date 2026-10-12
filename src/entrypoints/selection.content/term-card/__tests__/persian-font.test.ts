// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

vi.mock("#imports", () => ({
  browser: { runtime: { getURL: (path = "") => `chrome-extension://test${path}` } },
}))
vi.mock("@/utils/logger", () => ({
  logger: { warn: vi.fn<() => void>(), error: vi.fn<() => void>(), info: vi.fn<() => void>() },
}))

const constructed: Array<{ family: string; source: string; descriptors: FontFaceDescriptors }> = []
const loadMock = vi.fn<() => Promise<void>>()
const addMock = vi.fn<(face: unknown) => void>()

class FakeFontFace {
  constructor(family: string, source: string, descriptors: FontFaceDescriptors) {
    constructed.push({ family, source, descriptors })
  }

  load = loadMock
}

describe("ensurePersianFont", () => {
  beforeEach(async () => {
    constructed.length = 0
    loadMock.mockReset().mockResolvedValue()
    addMock.mockReset()
    vi.stubGlobal("FontFace", FakeFontFace)
    Object.defineProperty(document, "fonts", { value: { add: addMock }, configurable: true })
    const { resetPersianFontForTests } = await import("../persian-font")
    resetPersianFontForTests()
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it("registers Vazirmatn for Arabic-script text only, from the extension URL", async () => {
    const { ensurePersianFont, PERSIAN_FONT_FAMILY, PERSIAN_UNICODE_RANGE } =
      await import("../persian-font")

    await ensurePersianFont()

    expect(constructed).toHaveLength(1)
    expect(constructed[0]!.family).toBe(PERSIAN_FONT_FAMILY)
    expect(constructed[0]!.source).toMatch(
      /^url\("chrome-extension:\/\/[^/]+\/.*Vazirmatn-Variable/,
    )
    expect(constructed[0]!.descriptors.unicodeRange).toBe(PERSIAN_UNICODE_RANGE)
    expect(addMock).toHaveBeenCalledTimes(1)
  })

  it("loads only once however often it is called", async () => {
    const { ensurePersianFont } = await import("../persian-font")

    await Promise.all([ensurePersianFont(), ensurePersianFont()])
    await ensurePersianFont()

    expect(constructed).toHaveLength(1)
  })

  it("falls back quietly and retries next time when loading fails", async () => {
    const { ensurePersianFont } = await import("../persian-font")
    loadMock.mockRejectedValueOnce(new Error("blocked"))

    await expect(ensurePersianFont()).resolves.toBeUndefined()
    await ensurePersianFont()

    expect(constructed).toHaveLength(2)
  })

  it("does nothing where FontFace is unavailable", async () => {
    vi.stubGlobal("FontFace", undefined)
    const { ensurePersianFont } = await import("../persian-font")

    await expect(ensurePersianFont()).resolves.toBeUndefined()
    expect(constructed).toHaveLength(0)
  })
})
