import React, { useEffect, useRef } from "react"

declare global {
  namespace JSX {
    interface IntrinsicElements {
      "decision-card": React.DetailedHTMLProps<React.HTMLAttributes<HTMLElement>, HTMLElement>
    }
  }
}
import "./decision-card.js"

export interface DecisionCardProps {
  title?: string
  confidence?: string | number
  confidenceLabel?: string
  confidenceColor?: string
  content?: string
  phrase?: string
  videoUrl?: string
  knowledgeId?: number | null
  knowledgeMetadata?: Record<string, unknown> | null
  providerId?: number | null
  pageUrl?: string | null
  pageMatchId?: number | null
  onDecisionSelect?: (action: string) => void
  onBack?: () => void
  backLabel?: string
  backAriaLabel?: string
}

export function DecisionCard({
  title,
  confidence,
  confidenceLabel,
  confidenceColor,
  content,
  phrase,
  videoUrl,
  knowledgeId,
  knowledgeMetadata,
  providerId,
  pageUrl,
  pageMatchId,
  onDecisionSelect,
  onBack,
  backLabel,
  backAriaLabel,
}: DecisionCardProps) {
  const ref = useRef<HTMLElement | null>(null)

  useEffect(() => {
    const element = ref.current
    if (!onDecisionSelect || !element) return
    const listener = (event: any) => {
      const action = event?.detail?.action
      if (typeof action === "string") {
        onDecisionSelect(action)
      }
    }
    element.addEventListener("decision-select", listener)
    return () => {
      element.removeEventListener("decision-select", listener)
    }
  }, [onDecisionSelect])

  useEffect(() => {
    const element = ref.current
    if (!element) return
    if (title !== undefined) element.setAttribute("data-title", title)
    if (confidence !== undefined) element.setAttribute("data-confidence", String(confidence))
    if (content !== undefined) element.setAttribute("data-content", content)
    if (videoUrl !== undefined) element.setAttribute("data-video", videoUrl)
    if (phrase !== undefined) element.setAttribute("data-phrase", phrase)
    if (confidenceLabel !== undefined) element.setAttribute("data-confidence-label", confidenceLabel)
    if (confidenceColor !== undefined) element.setAttribute("data-confidence-color", confidenceColor)
    if (providerId !== undefined && providerId !== null) {
      element.setAttribute("data-provider-id", String(providerId))
    }
    if (pageUrl !== undefined && pageUrl !== null) {
      element.setAttribute("data-page-url", pageUrl)
    }
    if (backLabel !== undefined) {
      element.setAttribute("data-back-label", backLabel)
    } else {
      element.removeAttribute("data-back-label")
    }
    if (backAriaLabel !== undefined) {
      element.setAttribute("data-back-aria-label", backAriaLabel)
    } else {
      element.removeAttribute("data-back-aria-label")
    }
    if (knowledgeId !== undefined && knowledgeId !== null) {
      element.setAttribute("data-knowledge-id", String(knowledgeId))
    }
    if (knowledgeMetadata !== undefined && knowledgeMetadata !== null) {
      element.setAttribute("data-knowledge-metadata", JSON.stringify(knowledgeMetadata))
    } else {
      element.removeAttribute("data-knowledge-metadata")
    }
    if (pageMatchId !== undefined && pageMatchId !== null) {
      element.setAttribute("data-page-match-id", String(pageMatchId))
    }
  }, [
    title,
    confidence,
    confidenceLabel,
    confidenceColor,
    content,
    phrase,
    videoUrl,
    knowledgeId,
    knowledgeMetadata,
    providerId,
    pageUrl,
    pageMatchId,
    backLabel,
    backAriaLabel,
  ])

  useEffect(() => {
    const element = ref.current
    if (!element || !onBack) return
    const listener = () => onBack()
    element.addEventListener("decision-back", listener)
    return () => {
      element.removeEventListener("decision-back", listener)
    }
  }, [onBack])

  return <decision-card ref={ref} />
}
