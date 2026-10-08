import {
  ISO6393_TO_6391,
  LANG_CODE_ISO6393_OPTIONS,
  LANG_CODE_TO_EN_NAME,
  LANG_DICTIONARY_LABELS,
  RTL_LANG_CODES,
} from "@read-frog/definitions"
import { describe, expect, it } from "vitest"
import { getLanguageDirectionAndLang } from "@/utils/content/language-direction"

// Persian is `pes` (Iranian Persian) in this codebase. These tests pin down
// what the fork depends on for Persian output, so a failure names the gap.
describe("Persian (pes) support", () => {
  it("is a selectable language", () => {
    expect(LANG_CODE_ISO6393_OPTIONS).toContain("pes")
  })

  it("has an English name and a two-letter code", () => {
    expect(LANG_CODE_TO_EN_NAME.pes).toBeTruthy()
    expect(ISO6393_TO_6391.pes).toBe("fa")
  })

  it("is treated as right-to-left", () => {
    expect(RTL_LANG_CODES).toContain("pes")
    expect(getLanguageDirectionAndLang("pes")).toEqual({ dir: "rtl", lang: "fa" })
  })

  it("has dictionary labels", () => {
    expect(LANG_DICTIONARY_LABELS.pes.definition).toBeTruthy()
  })
})
