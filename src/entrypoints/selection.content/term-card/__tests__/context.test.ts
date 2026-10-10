import { describe, expect, it } from "vitest"
import { windowContext } from "../context"

describe("windowContext", () => {
  it("returns short context whole, with whitespace collapsed", () => {
    expect(windowContext("A  short\n context.", "short")).toBe("A short context.")
  })

  it("keeps the part around the selection of a long paragraph", () => {
    const before = "x".repeat(1000)
    const after = "y".repeat(1000)
    const result = windowContext(`${before} latency ${after}`, "latency", 50)
    expect(result).toContain("latency")
    expect(result.startsWith("…")).toBe(true)
    expect(result.endsWith("…")).toBe(true)
    expect(result.length).toBeLessThan(130)
  })

  it("falls back to the start when the text is not in the context", () => {
    const result = windowContext("a".repeat(2000), "missing", 50)
    expect(result).toHaveLength(100)
  })
})
