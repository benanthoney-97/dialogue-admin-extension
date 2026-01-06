import { useEffect, useState, useRef } from "react"
import "./style.css"
import { DecisionCard } from "./components/decision-card"
import type { DecisionCardProps } from "./components/decision-card"
import { ProviderDocumentsGrid } from "./components/provider-documents-grid"
import type { ProviderDocument } from "./components/provider-documents-grid"
import { ThresholdControls } from "./components/threshold-controls"
import { PageSummary } from "./components/page-summary"
import { BottomNavigation } from "./components/bottom-navigation"
import { SitemapView } from "./components/sitemap-view"
import { TimestampView } from "./components/timestamp-view"

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
  confidence_label?: string
  confidence_color?: string
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
  const [toastMessage, setToastMessage] = useState<string | null>(null)
  const toastTimerRef = useRef<number | null>(null)
  const [decisionCardVisible, setDecisionCardVisible] = useState(false)
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
    confidenceLabel: match?.confidence_label,
    confidenceColor: match?.confidence_color,
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

  const handleFeedToggle = async (feedId: number, tracked: boolean) => {
    try {
      await fetch(`${backendBase.replace(/\/+$/, "")}/api/sitemap-feed-status`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ feed_id: feedId, tracked }),
      })
    } catch (error) {
      console.error("[panel] sitemap feed toggle error", error)
    }
  }

  const handlePageToggle = async (pageId: number, tracked: boolean) => {
    try {
      console.log("[panel] toggling page status", { page_id: pageId, tracked })
      const response = await fetch(`${backendBase.replace(/\/+$/, "")}/api/sitemap-page-status`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ page_id: pageId, tracked }),
      })
      const data = await response.json().catch(() => null)
      console.log("[panel] page toggle response", response.status, data)
    } catch (error) {
      console.error("[panel] sitemap page toggle error", error)
    }
  }

  const handleMatchSelect = async (pageMatchId: number) => {
    if (!pageMatchId) return
    try {
      console.log("[panel] handleMatchSelect start", { pageMatchId })
      const matchEndpoint = `${backendBase.replace(/\/+$/, "")}/api/page-match?page_match_id=${pageMatchId}`
      console.log("[panel] fetching page match", matchEndpoint)
      const pageMatchResponse = await fetch(matchEndpoint)
      if (!pageMatchResponse.ok) {
        const text = await pageMatchResponse.text()
        throw new Error(`Failed to load match (${pageMatchResponse.status}): ${text}`)
      }
      const pageMatch = await pageMatchResponse.json()
      console.log("[panel] page match response", pageMatch)

      const knowledgeId = pageMatch?.knowledge_id ?? ""
      const documentId = pageMatch?.document_id ?? ""
      const decisionEndpoint = `${backendBase.replace(/\/+$/, "")}/api/decision-data?provider_id=${PROVIDER_ID}&page_match_id=${pageMatchId}${
        documentId ? `&document_id=${documentId}` : ""
      }${knowledgeId ? `&knowledge_id=${knowledgeId}` : ""}`
      console.log("[panel] fetching decision data", decisionEndpoint)
      const decisionResponse = await fetch(decisionEndpoint)
      console.log("[panel] decision response status", decisionResponse.status)
      const decisionData = decisionResponse.ok ? await decisionResponse.json() : {}
      console.log("[panel] decision data body", decisionData)

      const merged = {
        ...decisionData,
        ...pageMatch,
      }
      if (decisionData?.title) {
        merged.title = decisionData.title
      }
      if (decisionData?.video_url) {
        merged.video_url = decisionData.video_url
      }
      if (decisionData?.content) {
        merged.content = decisionData.content
      }

      console.debug("[panel] decision payload", merged)
      setMatch(merged)
      setDecisionCardVisible(true)
      setView(null)
    } catch (error) {
      console.error("[panel] fetch match error", error)
    }
  }

  const handleDecisionBack = () => {
    setDecisionCardVisible(false)
  }

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

  const [currentTabUrl, setCurrentTabUrl] = useState<string | null>(null)

  useEffect(() => {
    chrome.tabs?.query?.({ active: true, currentWindow: true }, (tabs) => {
      if (tabs && tabs.length > 0 && tabs[0]?.url) {
        setCurrentTabUrl(tabs[0].url)
      }
    })
  }, [])

  const pageUrl =
    (match?.url ||
      match?.source_url ||
      match?.document_title ||
      currentTabUrl ||
      "Current page") as string

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
      <TimestampView
        document={selectedDoc}
        videoUrl={match?.video_url}
        onBack={() => setView("documents")}
        onConfirm={handleTimestampConfirm}
      />
    )
  }

    switch (activeSection) {
      case "page":
        return decisionCardVisible && match ? (
          <div className="decision-card-shell">
            <DecisionCard
              {...cardProps}
              onDecisionSelect={handleDecisionSelect}
              onBack={handleDecisionBack}
            />
          </div>
        ) : (
          <PageSummary pageUrl={pageUrl} onMatchSelect={handleMatchSelect} />
        )
      case "threshold":
        return (
          <ThresholdControls
            current={threshold}
            onChange={handleThresholdChange}
            onSave={saveThresholdMatches}
            saving={thresholdSaving}
          />
        )
        case "sitemap":
        return (
          <SitemapView
            providerId={PROVIDER_ID}
            onFeedToggle={handleFeedToggle}
            onPageToggle={handlePageToggle}
          />
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
