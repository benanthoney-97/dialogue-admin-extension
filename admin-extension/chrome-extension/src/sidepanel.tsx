import { useEffect, useState } from "react"
import "./style.css"
import { DecisionCard } from "./components/decision-card"
import type { DecisionCardProps } from "./components/decision-card"
import { ProviderDocumentsGrid } from "./components/provider-documents-grid"
import type { ProviderDocument } from "./components/provider-documents-grid"
import { TimestampPicker } from "./components/timestamp-picker"

const PROVIDER_ID = 12

type MatchPayload = {
  title?: string
  video_url?: string
  confidence?: string | number
  content?: string
  knowledge_id?: number
  page_match_id?: number
  phrase?: string
  provider_id?: number
  document_id?: number
}

function SidePanel() {
  const [match, setMatch] = useState<MatchPayload | null>(null)
  const [view, setView] = useState<"card" | "documents" | "timestamp">("card")
  const [selectedDoc, setSelectedDoc] = useState<ProviderDocument | null>(null)

  useEffect(() => {
    const port = chrome.runtime.connect({ name: "admin-mode" })
    console.log("[panel] admin port connected")

    return () => {
      console.log("[panel] disconnecting admin port")
      port.disconnect()
    }
  }, [])

  useEffect(() => {
    console.log("[panel] mounted, requesting latest match")
    const listener = (message: any) => {
      console.log("[panel] received message", message)
      if (message.action === "matchData") {
        setMatch(message.match)
      }
    }

    chrome.runtime.onMessage.addListener(listener)

    chrome.runtime.sendMessage({ action: "getLatestMatch" }, (response) => {
      console.log("[panel] latest match response", response)
      if (response?.match) {
        setMatch(response.match)
      }
    })

    return () => {
      chrome.runtime.onMessage.removeListener(listener)
    }
  }, [])

  const cardProps: DecisionCardProps = {
    title: match?.title,
    videoUrl: match?.video_url,
    confidence: match?.confidence,
    content: match?.content,
    phrase: match?.phrase,
    knowledgeId: match?.knowledge_id ?? null,
    pageMatchId: match?.page_match_id ?? null,
  }

  const handleDecisionSelect = (action: string) => {
    if (action === "change") {
      setView("documents")
    }
  }

  const handleDocumentSelect = (doc: ProviderDocument) => {
    setSelectedDoc(doc)
    setView("timestamp")
  }

  const extractTimestamp = (url?: string) => {
    if (!url) return 0
    const match = url.match(/#t=(\d+)/)
    if (!match) return 0
    const value = Number(match[1])
    return Number.isNaN(value) ? 0 : value
  }

  const buildVideoUrl = (sourceUrl?: string, seconds?: number) => {
    if (!sourceUrl) return ""
    const [base] = sourceUrl.split("#")
    const normalizedSeconds = Math.max(0, Math.round(seconds || 0))
    return normalizedSeconds ? `${base}#t=${normalizedSeconds}` : base
  }

  const handleTimestampConfirm = async (seconds: number) => {
    console.log("[panel] timestamp confirmed", seconds, selectedDoc)
    if (!selectedDoc) {
      console.warn("[panel] no document selected")
      setView("card")
      return
    }
    if (!match?.page_match_id) {
      console.warn("[panel] missing page_match_id")
      setView("card")
      return
    }

    const videoUrl = buildVideoUrl(selectedDoc.source_url, seconds)
    const backendBase = (window as any).__SL_BACKEND_URL || "http://localhost:4173"
    const endpoint = `${backendBase.replace(/\/+$/, "")}/api/page-match`

    try {
      const response = await fetch(endpoint, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          page_match_id: match.page_match_id,
          document_id: selectedDoc.id,
          ...(videoUrl ? { video_url: videoUrl } : {}),
        }),
      })

      if (!response.ok) {
        const text = await response.text()
        throw new Error(`Failed to update match (${response.status}): ${text}`)
      }

      const refreshedMatch: MatchPayload = {
        ...match,
        document_id: selectedDoc.id,
        video_url: videoUrl || match.video_url,
      }

      chrome.runtime.sendMessage({ action: "refreshMatch", match: refreshedMatch })
    } catch (error) {
      console.error("[panel] timestamp update error", error)
    } finally {
      setView("card")
    }
  }

  const renderBody = () => {
    if (view === "documents") {
      return <ProviderDocumentsGrid providerId={PROVIDER_ID} onDocumentSelect={handleDocumentSelect} />
    }
    if (view === "timestamp" && selectedDoc) {
      return (
        <div className="timestamp-view">
          <div className="timestamp-view__header">
            <button type="button" className="timestamp-view__back" onClick={() => setView("documents")}>
              <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" viewBox="0 0 16 16">
                <path fillRule="evenodd" d="M15 8a.5.5 0 0 0-.5-.5H2.707l3.147-3.146a.5.5 0 1 0-.708-.708l-4 4a.5.5 0 0 0 0 .708l4 4a.5.5 0 0 0 .708-.708L2.707 8.5H14.5A.5.5 0 0 0 15 8"/>
              </svg>
            </button>
            <span>Select starting point for "{selectedDoc.title}"</span>
          </div>
          <TimestampPicker
            videoUrl={selectedDoc.source_url || ""}
            initialTimestamp={match ? extractTimestamp(match.video_url) : 0}
            onConfirm={handleTimestampConfirm}
          />
        </div>
      )
    }
    return <DecisionCard {...cardProps} onDecisionSelect={handleDecisionSelect} />
  }

  return (
    <div className="flex h-screen w-full flex-col bg-transparent font-sans text-slate-900">
      <div className="flex-1 w-full flex flex-col items-stretch justify-start">
        {renderBody()}
      </div>
    </div>
  )
}

export default SidePanel
