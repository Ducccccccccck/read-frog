import { useAtomValue } from "jotai"
import { configFieldsAtomMap } from "@/utils/atoms/config"
import { urlMatchesPattern } from "@/utils/url-pattern"
import { TermCard } from "./term-card"
import { useAltHoverExplain } from "./use-alt-hover"

export { TermExplainButton } from "./term-button"

/**
 * The explanation card and its Alt+hover trigger. Follows the selection
 * toolbar's switches: off when the toolbar is off or disabled on this site.
 */
export function TermCardHost() {
  const selectionToolbar = useAtomValue(configFieldsAtomMap.selectionToolbar)
  const isSiteDisabled = selectionToolbar.disabledSelectionToolbarPatterns?.some((pattern) =>
    urlMatchesPattern(window.location.href, pattern),
  )
  const enabled = selectionToolbar.enabled && !isSiteDisabled

  useAltHoverExplain(enabled)

  return enabled ? <TermCard /> : null
}
