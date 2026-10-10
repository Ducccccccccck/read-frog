import { IconBulb } from "@tabler/icons-react"
import { useAtomValue, useSetAtom } from "jotai"
import { SelectionToolbarTooltip } from "@/components/ui/selection-popover/selection-tooltip"
import { contextAtom, selectionContentAtom } from "../selection-toolbar/atoms"
import { openTermCardAtom } from "./atoms"
import { windowContext } from "./context"

/** Toolbar button: explain the selection in simple Persian and English. */
export function TermExplainButton() {
  const selectionContent = useAtomValue(selectionContentAtom)
  const context = useAtomValue(contextAtom)
  const openTermCard = useSetAtom(openTermCardAtom)

  return (
    <SelectionToolbarTooltip
      content="توضیح · Explain"
      render={
        <button
          type="button"
          aria-label="Explain"
          className="flex h-7 shrink-0 cursor-pointer items-center justify-center px-2 hover:bg-muted"
          onClick={(event) => {
            const text = selectionContent?.trim()
            if (!text) return
            const rect = event.currentTarget.getBoundingClientRect()
            event.currentTarget.blur()
            openTermCard({
              text,
              context: windowContext(context?.text ?? text, text),
              anchor: { x: rect.left + rect.width / 2, y: rect.bottom },
            })
          }}
        />
      }
    >
      <IconBulb className="size-4.5" strokeWidth={1.6} />
    </SelectionToolbarTooltip>
  )
}
