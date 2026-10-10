import { buildContextSnapshot, createRangeSnapshot } from "../utils"

const WORD_CHAR = /[\p{L}\p{M}\p{N}_'’-]/u
const EDGE_JOINERS = /^[-'’]+|[-'’]+$/g

/**
 * The word around `offset` in `text`, as `[start, end)`. `null` when the offset
 * is not on a word (a space, punctuation, or past the end).
 */
export function expandWordBounds(
  text: string,
  offset: number,
): { start: number; end: number } | null {
  if (offset < 0 || offset >= text.length || !WORD_CHAR.test(text[offset])) {
    return null
  }

  let start = offset
  let end = offset + 1
  while (start > 0 && WORD_CHAR.test(text[start - 1])) start -= 1
  while (end < text.length && WORD_CHAR.test(text[end])) end += 1

  // Leading or trailing hyphens and apostrophes belong to the punctuation.
  const word = text.slice(start, end)
  const trimmed = word.replace(EDGE_JOINERS, "")
  if (!trimmed) {
    return null
  }
  const leading = word.indexOf(trimmed)
  return { start: start + leading, end: start + leading + trimmed.length }
}

function caretFromPoint(x: number, y: number): { node: Node; offset: number } | null {
  if (typeof document.caretPositionFromPoint === "function") {
    const position = document.caretPositionFromPoint(x, y)
    return position ? { node: position.offsetNode, offset: position.offset } : null
  }
  if (typeof document.caretRangeFromPoint === "function") {
    const range = document.caretRangeFromPoint(x, y)
    return range ? { node: range.startContainer, offset: range.startOffset } : null
  }
  return null
}

function isEditable(node: Node): boolean {
  const element = node instanceof Element ? node : node.parentElement
  return Boolean(element?.closest("input, textarea, select, [contenteditable]:not([contenteditable=false])"))
}

function rectContains(rect: DOMRect, x: number, y: number, slop = 2): boolean {
  return (
    x >= rect.left - slop && x <= rect.right + slop && y >= rect.top - slop && y <= rect.bottom + slop
  )
}

/**
 * The word under the pointer and the text around it, for Alt+hover. `null`
 * when the pointer is not on a word of page text (or is in a form field).
 */
export function getWordAtPoint(x: number, y: number): { text: string; context: string } | null {
  const caret = caretFromPoint(x, y)
  if (!caret || caret.node.nodeType !== Node.TEXT_NODE || isEditable(caret.node)) {
    return null
  }

  const data = (caret.node as Text).data
  // The caret lands on the nearest boundary, so a pointer on the last letter of
  // a word reports the offset after it.
  const bounds = expandWordBounds(data, caret.offset) ?? expandWordBounds(data, caret.offset - 1)
  if (!bounds) {
    return null
  }

  const range = document.createRange()
  range.setStart(caret.node, bounds.start)
  range.setEnd(caret.node, bounds.end)

  // The pointer must really be over the word, not just near its line.
  const rects = Array.from(range.getClientRects())
  if (rects.length > 0 && !rects.some((rect) => rectContains(rect, x, y))) {
    return null
  }

  const text = data.slice(bounds.start, bounds.end)
  const context = buildContextSnapshot({ text, ranges: [createRangeSnapshot(range)] })
  return { text, context: context?.text ?? text }
}
