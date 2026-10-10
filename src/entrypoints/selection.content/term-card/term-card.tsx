import type { TermInsight } from "@/utils/term-insight/types"
import { IconAlertTriangle, IconBulb, IconLoader2, IconRefresh, IconX } from "@tabler/icons-react"
import { useQuery } from "@tanstack/react-query"
import { useAtomValue, useSetAtom } from "jotai"
import { useCallback, useEffect, useLayoutEffect, useRef } from "react"
import { NOTRANSLATE_CLASS } from "@/utils/constants/dom-labels"
import { explainSelectedTerm } from "@/utils/host/translate/term-explain"
import { cn } from "@/utils/styles/utils"
import {
  SELECTION_CONTENT_OVERLAY_LAYERS,
  SELECTION_CONTENT_OVERLAY_ROOT_ATTRIBUTE,
} from "../overlay-layers"
import { closeTermCardAtom, termCardAtom } from "./atoms"

const CARD_WIDTH = 340
const VIEWPORT_MARGIN = 8
const ANCHOR_GAP = 10

function useTermExplanationQuery(request: { id: number; text: string; context: string }) {
  return useQuery({
    queryKey: ["term-explain", request.id],
    queryFn: () => explainSelectedTerm(request.text, request.context),
    staleTime: Number.POSITIVE_INFINITY,
    gcTime: 60_000,
    retry: false,
  })
}

function Section({ label, dir, children }: { label: string; dir: "rtl" | "ltr"; children: string }) {
  return (
    <div className="space-y-0.5">
      <div className="text-[11px] font-medium tracking-wide text-muted-foreground">{label}</div>
      <p dir={dir} className="text-sm leading-6 [overflow-wrap:anywhere] break-words">
        {children}
      </p>
    </div>
  )
}

function Explanation({ insight, fromPage }: { insight: TermInsight; fromPage: boolean }) {
  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 gap-3">
        <Section label="فارسی" dir="rtl">
          {insight.fa}
        </Section>
        <Section label="English" dir="ltr">
          {insight.en}
        </Section>
      </div>
      <div className="h-px bg-border" />
      <Section label="معنی" dir="rtl">
        {insight.meaningFa}
      </Section>
      <Section label="Meaning" dir="ltr">
        {insight.meaningEn}
      </Section>
      {insight.confidence === "low" && (
        <div className="flex items-start gap-1.5 rounded-md bg-muted px-2 py-1.5 text-xs text-muted-foreground">
          <IconAlertTriangle className="mt-0.5 size-3.5 shrink-0" strokeWidth={1.6} />
          <span>
            <span dir="rtl">ممکن است این توضیح کامل یا به‌روز نباشد.</span>{" "}
            <span dir="ltr">This may be incomplete or out of date.</span>
          </span>
        </div>
      )}
      <div className="text-right text-[10px] text-muted-foreground">
        {fromPage ? "از اصطلاحات صفحه · From page terms" : "AI"}
      </div>
    </div>
  )
}

export function TermCard() {
  const request = useAtomValue(termCardAtom)
  const close = useSetAtom(closeTermCardAtom)
  const cardRef = useRef<HTMLDivElement>(null)

  // Hang the card from its anchor, kept inside the viewport and flipped above
  // the anchor when there is no room below.
  const place = useCallback(() => {
    const card = cardRef.current
    if (!card || !request) return

    const width = Math.min(CARD_WIDTH, window.innerWidth - VIEWPORT_MARGIN * 2)
    const height = card.offsetHeight
    const left = Math.min(
      Math.max(request.anchor.x - width / 2, VIEWPORT_MARGIN),
      window.innerWidth - width - VIEWPORT_MARGIN,
    )
    const below = request.anchor.y + ANCHOR_GAP
    const top =
      below + height + VIEWPORT_MARGIN > window.innerHeight
        ? Math.max(VIEWPORT_MARGIN, request.anchor.y - ANCHOR_GAP * 2 - height)
        : below

    card.style.width = `${width}px`
    card.style.left = `${left}px`
    card.style.top = `${top}px`
  }, [request])

  useLayoutEffect(() => {
    place()
  })

  useEffect(() => {
    if (!request) return undefined
    const card = cardRef.current

    const handleMouseDown = (event: MouseEvent) => {
      if (card && !event.composedPath().includes(card)) {
        close()
      }
    }
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") close()
    }

    document.addEventListener("mousedown", handleMouseDown, true)
    document.addEventListener("keydown", handleKeyDown, true)
    window.addEventListener("resize", place)
    return () => {
      document.removeEventListener("mousedown", handleMouseDown, true)
      document.removeEventListener("keydown", handleKeyDown, true)
      window.removeEventListener("resize", place)
    }
  }, [close, place, request])

  if (!request) {
    return null
  }

  return (
    <TermCardBody
      key={request.id}
      cardRef={cardRef}
      request={request}
      onClose={() => close()}
      onResize={place}
    />
  )
}

function TermCardBody({
  cardRef,
  request,
  onClose,
  onResize,
}: {
  cardRef: React.RefObject<HTMLDivElement | null>
  request: { id: number; text: string; context: string }
  onClose: () => void
  onResize: () => void
}) {
  const query = useTermExplanationQuery(request)
  const result = query.data

  // The content changes height when the answer arrives.
  useLayoutEffect(() => {
    onResize()
  }, [onResize, query.status, result?.status])

  return (
    <div
      ref={cardRef}
      role="dialog"
      aria-label="Term explanation"
      className={cn(
        NOTRANSLATE_CLASS,
        `pointer-events-auto fixed ${SELECTION_CONTENT_OVERLAY_LAYERS.selectionOverlay}`,
        "max-h-[70vh] overflow-y-auto rounded-lg border border-border/50 bg-popover p-3 text-popover-foreground shadow-lg",
      )}
      {...{ [SELECTION_CONTENT_OVERLAY_ROOT_ATTRIBUTE]: "" }}
    >
      <div className="mb-2 flex items-start gap-2">
        <IconBulb className="mt-0.5 size-4 shrink-0 text-muted-foreground" strokeWidth={1.6} />
        <div dir="auto" className="min-w-0 flex-1 text-sm font-semibold [overflow-wrap:anywhere]">
          {request.text}
        </div>
        <button
          type="button"
          aria-label="Close"
          className="flex size-6 shrink-0 cursor-pointer items-center justify-center rounded hover:bg-muted"
          onClick={onClose}
        >
          <IconX className="size-4" strokeWidth={1.6} />
        </button>
      </div>

      {query.isPending && (
        <div className="flex items-center gap-2 py-3 text-sm text-muted-foreground">
          <IconLoader2 className="size-4 animate-spin" strokeWidth={1.6} />
          <span dir="rtl">در حال بررسی…</span>
          <span dir="ltr">Looking it up…</span>
        </div>
      )}

      {result?.status === "ok" && (
        <Explanation
          insight={result.explanation.insight}
          fromPage={result.explanation.source === "page"}
        />
      )}

      {result?.status === "no-provider" && (
        <div className="space-y-1 py-1 text-sm text-muted-foreground">
          <p dir="rtl">برای توضیح، در تنظیمات یک سرویس هوش مصنوعی (LLM) انتخاب کنید.</p>
          <p dir="ltr">Choose an AI (LLM) provider in the settings to get explanations.</p>
        </div>
      )}

      {(query.isError || result?.status === "failed") && (
        <div className="space-y-2 py-1 text-sm text-muted-foreground">
          <p dir="rtl">توضیح دریافت نشد. دوباره تلاش کنید.</p>
          <p dir="ltr">Could not get an explanation. Please try again.</p>
          <button
            type="button"
            className="inline-flex cursor-pointer items-center gap-1 rounded px-2 py-1 text-xs hover:bg-muted"
            onClick={() => void query.refetch()}
          >
            <IconRefresh className="size-3.5" strokeWidth={1.6} />
            Retry / تلاش دوباره
          </button>
        </div>
      )}
    </div>
  )
}
