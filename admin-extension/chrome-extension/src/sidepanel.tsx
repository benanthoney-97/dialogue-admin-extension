import { useEffect, useState, useRef } from "react"
import "./style.css"
import { DecisionCard } from "./components/decision-card"
import type { DecisionCardProps } from "./components/decision-card"
import { ProviderDocumentsGrid } from "./components/provider-documents-grid"
import type { ProviderDocument } from "./components/provider-documents-grid"
import { TimestampPicker } from "./components/timestamp-picker"
import { ThresholdSelector } from "./components/threshold-selector"
import { ConfirmAction } from "./components/confirm-action"
import { PageSummary } from "./components/page-summary"
import { BottomNavigation } from "./components/bottom-navigation"
import { SitemapFeedsTable } from "./components/sitemap-feeds-table"
import { SitemapPagesTable } from "./components/sitemap-pages-table"

const PROVIDER_ID = 12
const THRESHOLD_VALUES: Record<"high" | "medium" | "low", number> = {
  high: 0.75,
  medium: 0.6,
  low: 0.4,
}

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
  document_title?: string
  status?: string
  url?: string
  source_url?: string
}

type NavSection = "page" | "threshold" | "sitemap" | "platforms"

function SidePanel() {
  const [match, setMatch] = useState<MatchPayload | null>(null)
  const [view, setView] = useState<"documents" | "timestamp" | null>(null)
  const [selectedDoc, setSelectedDoc] = useState<ProviderDocument | null>(null)
  const [threshold, setThreshold] = useState<"high" | "medium" | "low">("medium")
  const [activeSection, setActiveSection] = useState<NavSection>("page")
  const [selectedFeedId, setSelectedFeedId] = useState<number | null>(null)
  const [toastMessage, setToastMessage] = useState<string | null>(null)
  const toastTimerRef = useRef<number | null>(null)
  const [decisionCardVisible, setDecisionCardVisible] = useState(false)
  const [showThresholdConfirm, setShowThresholdConfirm] = useState(false)
  const [thresholdSaving, setThresholdSaving] = useState(false)

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
      if (message.action === "matchClicked") {
        setMatch(message.match)
        setDecisionCardVisible(true)
      } else if (message.action === "matchData") {
        setMatch(message.match)
      } else if (message.action === "thresholdData") {
        const value = message.threshold
        if (value && ["high", "medium", "low"].includes(value)) {
          setThreshold(value)
          chrome.storage?.local?.set({ threshold: value })
        }
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

  useEffect(() => {
    chrome.storage?.local?.get?.({ threshold: "medium" }, (result) => {
      if (result?.threshold && ["high", "medium", "low"].includes(result.threshold)) {
        setThreshold(result.threshold)
      }
    })
  }, [])

  const cardProps: DecisionCardProps = {
    title: match?.title,
    videoUrl: match?.video_url,
    confidence: match?.confidence,
    content: match?.content,
    phrase: match?.phrase,
    knowledgeId: match?.knowledge_id ?? null,
    pageMatchId: match?.page_match_id ?? null,
    status: match?.status,
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

  const handleThresholdChange = (value: "high" | "medium" | "low") => {
    setThreshold(value)
    chrome.storage?.local?.set?.({ threshold: value })
    chrome.runtime.sendMessage({ action: "setThreshold", threshold: value })
    setToastMessage(`Threshold set to ${value.charAt(0).toUpperCase() + value.slice(1)}`)
  }

  const backendBase = (window as any).__SL_BACKEND_URL || "http://localhost:4173"

  const saveThresholdMatches = async () => {
    setThresholdSaving(true)
    try {
      const response = await fetch(`${backendBase}/api/match-map?provider_id=${PROVIDER_ID}`)
      if (!response.ok) {
        const errText = await response.text()
        throw new Error(`Fetch matches failed (${response.status}): ${errText}`)
      }
      const matches = await response.json()
      const thresholdValue = THRESHOLD_VALUES[threshold]
      const toUpdate = (matches || []).filter(
        (match: any) =>
          match?.status !== "inactive" &&
          typeof match?.confidence === "number" &&
          match.confidence < thresholdValue
      )
      if (!toUpdate.length) {
        setToastMessage("No active matches below the selected threshold")
        return
      }
      await Promise.all(
        toUpdate.map((match: any) =>
          fetch(`${backendBase}/api/page-match-status`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              page_match_id: match.page_match_id,
              status: "inactive",
            }),
          }).then(async (res) => {
            if (!res.ok) {
              const text = await res.text()
              throw new Error(`Status update failed (${res.status}): ${text}`)
            }
          })
        )
      )
      setToastMessage(`Saved threshold: ${toUpdate.length} match${toUpdate.length !== 1 ? "es" : ""} hidden`)
      chrome.runtime.sendMessage({ action: "thresholdData", threshold })
    } catch (error) {
      console.error("[panel] threshold save error", error)
      setToastMessage("Failed to persist threshold changes")
    } finally {
      setThresholdSaving(false)
    }
  }

  const handleThresholdSave = () => {
    setShowThresholdConfirm(true)
  }

  const handleConfirmCancel = () => {
    setShowThresholdConfirm(false)
  }

  const handleConfirmSave = () => {
    setShowThresholdConfirm(false)
    saveThresholdMatches()
  }

  useEffect(() => {
    if (toastMessage) {
      if (toastTimerRef.current) {
        window.clearTimeout(toastTimerRef.current)
      }
      toastTimerRef.current = window.setTimeout(() => {
        setToastMessage(null)
      }, 2800)
    }
    return () => {
      if (toastTimerRef.current) {
        window.clearTimeout(toastTimerRef.current)
      }
    }
  }, [toastMessage])

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
      setView(null)
      return
    }
    if (!match?.page_match_id) {
      console.warn("[panel] missing page_match_id")
      setView(null)
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
      setView(null)
    }
  }

  const activeMatchesCount = match ? (match.status === "inactive" ? 0 : 1) : 0
  const inactiveMatchesCount = match ? (match.status === "inactive" ? 1 : 0) : 0
  const pageUrl =
    (match?.url || match?.source_url || match?.document_title || "Current page") as string

  useEffect(() => {
    console.log("[panel] resolved pageUrl", pageUrl)
    if (match) {
      console.log("[panel] match status", match.status, "confidence", match.confidence)
    }
  }, [match, pageUrl])

  const renderContent = () => {
    if (view === "documents") {
      return <ProviderDocumentsGrid onDocumentSelect={handleDocumentSelect} />
    }
    if (view === "timestamp" && selectedDoc) {
      return (
        <div className="timestamp-view">
          <div className="timestamp-view__header">
            <button
              type="button"
              className="timestamp-view__back"
              onClick={() => setView("documents")}
            >
              <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" viewBox="0 0 16 16">
                <path
                  fillRule="evenodd"
                  d="M15 8a.5.5 0 0 0-.5-.5H2.707l3.147-3.146a.5.5 0 1 0-.708-.708l-4 4a.5.5 0 0 0 0 .708l4 4a.5.5 0 0 0 .708-.708L2.707 8.5H14.5A.5.5 0 0 0 15 8"
                />
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

    switch (activeSection) {
      case "page":
        return decisionCardVisible && match ? (
          <DecisionCard {...cardProps} onDecisionSelect={handleDecisionSelect} />
        ) : (
          <PageSummary
            pageUrl={pageUrl}
            activeMatches={activeMatchesCount}
            inactiveMatches={inactiveMatchesCount}
          />
        )
      case "threshold":
        return (
          <>
            <ThresholdSelector current={threshold} onChange={handleThresholdChange} />
            <div className="threshold-save-footer">
              <button
                type="button"
                className="threshold-save-footer__button"
                onClick={handleThresholdSave}
                disabled={thresholdSaving}
              >
                {thresholdSaving ? "Saving…" : "Save threshold"}
              </button>
            </div>
            <ConfirmAction
              visible={showThresholdConfirm}
              title="Persist threshold"
              message="This will mark every active match below the selected threshold as hidden. It will overwrite any previous manual changes."
              confirmLabel="Save"
              cancelLabel="Cancel"
              onConfirm={handleConfirmSave}
              onCancel={handleConfirmCancel}
            />
          </>
        )
      case "sitemap":
        return (
          <>
            <SitemapFeedsTable
              providerId={PROVIDER_ID}
              onFeedSelect={(feed) => setSelectedFeedId(feed.id)}
            />
            <SitemapPagesTable feedId={selectedFeedId ?? undefined} />
          </>
        )
      case "platforms":
        return (
          <div className="platforms-panel">
            <p className="platforms-panel__placeholder">
              Platform-level controls will live here soon.
            </p>
          </div>
        )
      default:
        return null
    }
  }

  return (
    <div className="flex h-screen w-full flex-col bg-transparent font-sans text-slate-900">
      {toastMessage && <div className="panel-toast">{toastMessage}</div>}
      <div className="sidepanel__body">
        <div className="sidepanel__content-scroll">{renderContent()}</div>
      </div>
      <BottomNavigation
        active={activeSection}
        onSelect={(selection) => {
          setView(null)
          setActiveSection(selection)
          if (selection !== "page") {
            setDecisionCardVisible(false)
          }
        }}
      />
    </div>
  )
}

export default SidePanel
