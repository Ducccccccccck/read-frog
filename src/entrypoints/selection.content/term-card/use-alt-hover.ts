import { useSetAtom } from "jotai"
import { useEffect } from "react"
import { SELECTION_CONTENT_OVERLAY_ROOT_ATTRIBUTE } from "../overlay-layers"
import { openTermCardAtom } from "./atoms"
import { windowContext } from "./context"
import { getWordAtPoint } from "./word-at-point"

/** Pause on a word before the card opens, so sweeping the pointer stays quiet. */
export const ALT_HOVER_DELAY_MS = 350

/**
 * Alt + hover: with Alt held, resting the pointer on a word opens its card.
 * Nothing is listened for beyond a cheap `altKey` check on mouse moves.
 */
export function useAltHoverExplain(enabled: boolean) {
  const openTermCard = useSetAtom(openTermCardAtom)

  useEffect(() => {
    if (!enabled) return undefined

    let timer: ReturnType<typeof setTimeout> | null = null
    let lastWord: { text: string; x: number; y: number } | null = null

    const clear = () => {
      if (timer !== null) {
        clearTimeout(timer)
        timer = null
      }
    }

    const handleMouseMove = (event: MouseEvent) => {
      if (!event.altKey) {
        clear()
        lastWord = null
        return
      }
      if (
        event.composedPath().some(
          (node) => node instanceof Element && node.hasAttribute(SELECTION_CONTENT_OVERLAY_ROOT_ATTRIBUTE),
        )
      ) {
        clear()
        return
      }

      clear()
      const { clientX: x, clientY: y } = event
      timer = setTimeout(() => {
        timer = null
        const word = getWordAtPoint(x, y)
        // Still resting on the word that already has its card: leave it be.
        if (!word || (lastWord && lastWord.text === word.text && Math.hypot(lastWord.x - x, lastWord.y - y) < 40)) {
          return
        }
        lastWord = { text: word.text, x, y }
        openTermCard({
          text: word.text,
          context: windowContext(word.context, word.text),
          anchor: { x, y },
        })
      }, ALT_HOVER_DELAY_MS)
    }

    document.addEventListener("mousemove", handleMouseMove, { passive: true })
    return () => {
      clear()
      document.removeEventListener("mousemove", handleMouseMove)
    }
  }, [enabled, openTermCard])
}
