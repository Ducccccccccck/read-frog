import { atom } from "jotai"

export interface TermCardRequest {
  /** Bumped per request so re-opening the same word still refreshes the card. */
  id: number
  text: string
  /** Text around the selection; picks the right sense of a word. */
  context: string
  /** Viewport point the card hangs from (a button's bottom edge or the pointer). */
  anchor: { x: number; y: number }
}

let nextTermCardRequestId = 0

export const termCardAtom = atom<TermCardRequest | null>(null)

export const openTermCardAtom = atom(
  null,
  (_get, set, request: Omit<TermCardRequest, "id">) => {
    set(termCardAtom, { ...request, id: ++nextTermCardRequestId })
  },
)

export const closeTermCardAtom = atom(null, (_get, set) => {
  set(termCardAtom, null)
})
