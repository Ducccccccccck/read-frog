import { browser } from "#imports"
import vazirmatnUrl from "@/assets/fonts/Vazirmatn-Variable.woff2?url&no-inline"
import { logger } from "@/utils/logger"

/**
 * Persian text in the explanation card is set in Vazirmatn (SIL OFL, bundled
 * with its licence in `assets/fonts`). Pages rarely ship a good Persian font and
 * the system fallback is often Tahoma or Arial.
 *
 * The family name is private so it never replaces a font the page itself uses.
 * `unicodeRange` limits it to Arabic-script characters, so English text in the
 * same card keeps the normal UI font.
 */
export const PERSIAN_FONT_FAMILY = "RF Vazirmatn"

export const PERSIAN_FONT_STACK = `"${PERSIAN_FONT_FAMILY}", ui-sans-serif, system-ui, sans-serif`

export const PERSIAN_UNICODE_RANGE =
  "U+0600-06FF, U+0750-077F, U+08A0-08FF, U+FB50-FDFF, U+FE70-FEFF, U+200C-200D"

let loading: Promise<boolean> | null = null

async function loadPersianFont(): Promise<boolean> {
  try {
    const url = new URL(vazirmatnUrl, browser.runtime.getURL("/")).href
    const face = new FontFace(PERSIAN_FONT_FAMILY, `url("${url}") format("woff2")`, {
      weight: "100 900",
      display: "swap",
      unicodeRange: PERSIAN_UNICODE_RANGE,
    })
    document.fonts.add(face)
    await face.load()
    return true
  } catch (error) {
    logger.warn("Could not load the Persian font; using the system font", error)
    return false
  }
}

/**
 * Register the font with the page's font set (shadow roots cannot declare their
 * own `@font-face`). Safe to call on every card open: it loads once, and a
 * failure only means the system font is used instead, with a retry next time.
 */
export async function ensurePersianFont(): Promise<void> {
  if (typeof FontFace === "undefined" || typeof document === "undefined") {
    return
  }

  const attempt = (loading ??= loadPersianFont())
  if (!(await attempt) && loading === attempt) {
    loading = null
  }
}

/** Test seam. */
export function resetPersianFontForTests() {
  loading = null
}
