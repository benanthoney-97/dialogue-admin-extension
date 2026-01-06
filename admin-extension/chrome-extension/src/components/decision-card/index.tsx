import React, { useEffect, useRef } from "react"
import "./decision-card.js"

export interface DecisionCardProps {
  title?: string
  confidence?: string | number
  content?: string
  phrase?: string
  videoUrl?: string
  status?: string
  knowledgeId?: number | null
  pageMatchId?: number | null
  onDecisionSelect?: (action: string) => void
  onBack?: () => void
}

export function DecisionCard({
  title,
  confidence,
  content,
  phrase,
  videoUrl,
  status,
  knowledgeId,
  pageMatchId,
  onDecisionSelect,
  onBack,
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
    if (status !== undefined) {
      console.log("[DecisionCard] setting attribute data-status", status)
      element.setAttribute("data-status", status)
    }
    if (knowledgeId !== undefined && knowledgeId !== null) {
      element.setAttribute("data-knowledge-id", String(knowledgeId))
    }
    if (pageMatchId !== undefined && pageMatchId !== null) {
      element.setAttribute("data-page-match-id", String(pageMatchId))
    }
  }, [title, confidence, content, phrase, videoUrl, status, knowledgeId, pageMatchId])

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
