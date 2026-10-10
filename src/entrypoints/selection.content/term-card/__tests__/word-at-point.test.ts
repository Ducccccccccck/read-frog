import { describe, expect, it } from "vitest"
import { expandWordBounds } from "../word-at-point"

function wordAt(text: string, offset: number) {
  const bounds = expandWordBounds(text, offset)
  return bounds ? text.slice(bounds.start, bounds.end) : null
}

describe("expandWordBounds", () => {
  it("finds the word around any offset inside it", () => {
    expect(wordAt("the quick fox", 5)).toBe("quick")
    expect(wordAt("the quick fox", 4)).toBe("quick")
    expect(wordAt("the quick fox", 8)).toBe("quick")
  })

  it("returns null on spaces, punctuation and past the end", () => {
    expect(wordAt("the quick fox", 3)).toBeNull()
    expect(wordAt("end.", 3)).toBeNull()
    expect(wordAt("end", 3)).toBeNull()
    expect(wordAt("end", -1)).toBeNull()
  })

  it("keeps inner hyphens and apostrophes but trims the edges", () => {
    expect(wordAt("a state-of-the-art model", 5)).toBe("state-of-the-art")
    expect(wordAt("don't stop", 1)).toBe("don't")
    expect(wordAt("-hello- there", 2)).toBe("hello")
  })

  it("handles Persian and mixed text", () => {
    expect(wordAt("این یک تأخیر است", 7)).toBe("تأخیر")
    expect(wordAt("مدل LLM بزرگ", 5)).toBe("LLM")
  })

  it("returns null for a run made only of joiners", () => {
    expect(wordAt("a --- b", 3)).toBeNull()
  })
})
