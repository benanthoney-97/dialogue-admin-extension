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
import { NewMatchPrompt } from "./components/new-match-prompt"
import { ConfirmAction } from "./components/confirm-action"

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
  id?: number
  phrase?: string
  provider_id?: number
  document_id?: number
  document_title?: string
  status?: string
  url?: string
  source_url?: string
}

type NavSection = "page" | "threshold" | "sitemap" | "new-match"

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
  const [removeConfirmVisible, setRemoveConfirmVisible] = useState(false)
  const [removeConfirmLoading, setRemoveConfirmLoading] = useState(false)
  const [pendingRemoveMatchId, setPendingRemoveMatchId] = useState<number | null>(null)
  const [selectedNewMatchText, setSelectedNewMatchText] = useState<string | null>(null)
  const [manualStage, setManualStage] = useState<"prompt" | "documents" | "timestamp">("prompt")
  const [manualSelectedDoc, setManualSelectedDoc] = useState<ProviderDocument | null>(null)
  const [autoMatchResults, setAutoMatchResults] = useState<any[]>([])
  const [autoMatchLoading, setAutoMatchLoading] = useState(false)
  const backendBase = (window as any).__SL_BACKEND_URL || "http://localhost:4173"
  const newMatchModeRef = useRef(false)

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
      } else if (message.action === "deliverNewMatchSelection") {
        if (message.text) {
          setSelectedNewMatchText(message.text)
          setToastMessage("Text captured for new match")
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
  }

  const resolveMatchRowId = () => {
    if (!match) return undefined
    if (typeof match.id === "number") return match.id
    if (typeof match.page_match_id === "number") return match.page_match_id
    return undefined
  }

  const openRemoveConfirm = () => {
    const matchRowId = resolveMatchRowId()
    if (matchRowId) {
      setPendingRemoveMatchId(matchRowId)
      setRemoveConfirmVisible(true)
    }
  }

  const closeRemoveConfirm = () => {
    setRemoveConfirmVisible(false)
    setPendingRemoveMatchId(null)
    setRemoveConfirmLoading(false)
  }

  const resetManualFlow = () => {
    setManualStage("prompt")
    setManualSelectedDoc(null)
  }

  const startManualFlow = () => {
    setManualStage("documents")
    setManualSelectedDoc(null)
  }

  const handleGetMatches = async () => {
    if (!selectedNewMatchText) {
      setToastMessage("Highlight text to look up matches")
      return
    }
    setAutoMatchLoading(true)
    setAutoMatchResults([])
    try {
      const response = await fetch(`${backendBase.replace(/\/+$/, "")}/api/match-suggestions`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          text: selectedNewMatchText,
          provider_id: PROVIDER_ID,
          match_count: 6,
        }),
      })
      if (!response.ok) {
        const payload = await response.text()
        throw new Error(`Failed to fetch matches (${response.status}): ${payload}`)
      }
      const payload = await response.json()
      setAutoMatchResults(Array.isArray(payload.results) ? payload.results : [])
    } catch (error) {
      console.error("[panel] match suggestions error", error)
      setToastMessage("Unable to load match suggestions")
    } finally {
      setAutoMatchLoading(false)
    }
  }

  const handleSelectMatchSuggestion = async (result: any) => {
    console.log("[panel] suggested match selected", result)
    if (!selectedNewMatchText) {
      setToastMessage("Highlight text to save a match")
      return
    }
    const docId = Number(result.document_id || result.documentId || 0)
    if (!docId) {
      setToastMessage("Unable to determine document for this match")
      return
    }
    const suggestedTimestamp =
      Number.isFinite(Number(result.suggested_timestamp)) && Number(result.suggested_timestamp) >= 0
        ? Number(result.suggested_timestamp)
        : Number.isFinite(Number(result.timestamp_end))
        ? Number(result.timestamp_end)
        : Number.isFinite(Number(result.timestamp_start))
        ? Number(result.timestamp_start)
        : Number.isFinite(Number(result.timestamp))
        ? Number(result.timestamp)
        : 0
    const normalizedUrl = buildVideoUrl(result.video_url || result.source_url || result.videoUrl, suggestedTimestamp)
    const timestampValue = suggestedTimestamp
    const endpoint = `${backendBase.replace(/\/+$/, "")}/api/create-page-match`

    try {
      const response = await fetch(endpoint, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          document_id: docId,
          provider_id: PROVIDER_ID,
          phrase: selectedNewMatchText,
          url: pageUrl,
          video_url: normalizedUrl,
          selected_timestamp: timestampValue,
          status: "active",
        }),
      })
      if (!response.ok) {
        const payload = await response.text()
        throw new Error(`Failed to create match (${response.status}): ${payload}`)
      }
      const createdMatch = await response.json()
      console.log("[panel] auto match created", createdMatch)
      setToastMessage("Match saved")
      setAutoMatchResults([])
      setSelectedNewMatchText(null)
      chrome.runtime.sendMessage({ action: "restoreMatchHighlight", match: createdMatch })
      setActiveSection("page")
      setMatch(createdMatch)
      setDecisionCardVisible(true)
      setAutoMatchLoading(false)
      chrome.runtime.sendMessage({ action: "exitNewMatchMode" })
      newMatchModeRef.current = false
    } catch (error) {
      console.error("[panel] auto match save error", error)
      setToastMessage("Unable to save match")
    }
  }

  useEffect(() => {
    setAutoMatchResults([])
  }, [selectedNewMatchText])

  const handleManualDocumentSelect = (doc: ProviderDocument) => {
    setManualSelectedDoc(doc)
    setManualStage("timestamp")
  }

  const handleManualBackToDocuments = () => {
    setManualStage("documents")
  }

  const handleManualTimestampConfirm = async (seconds: number) => {
    if (!manualSelectedDoc || !selectedNewMatchText) {
      setToastMessage("Please select text and a video")
      setManualStage("prompt")
      return
    }
    const videoUrl = buildVideoUrl(manualSelectedDoc.source_url, seconds)
    const endpoint = `${backendBase.replace(/\/+$/, "")}/api/create-page-match`
    try {
      const response = await fetch(endpoint, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          document_id: manualSelectedDoc.id,
          provider_id: PROVIDER_ID,
          phrase: selectedNewMatchText,
          url: pageUrl,
          video_url: videoUrl,
          selected_timestamp: seconds,
          status: "active",
        }),
      })
      if (!response.ok) {
        const payload = await response.text()
        throw new Error(`Failed to create match (${response.status}): ${payload}`)
      }
      const createdMatch = await response.json()
      console.log("[panel] manual match created", createdMatch)
      setToastMessage("Match saved")
      setManualStage("prompt")
      setManualSelectedDoc(null)
      setSelectedNewMatchText(null)
      chrome.runtime.sendMessage({ action: "restoreMatchHighlight", match: createdMatch })
      await handleMatchSelect(createdMatch.page_match_id)
      setActiveSection("page")
      chrome.runtime.sendMessage({ action: "exitNewMatchMode" })
      newMatchModeRef.current = false
    } catch (error) {
      console.error("[panel] manual match error", error)
      setToastMessage("Unable to save match")
    }
  }

  const handleConfirmRemoval = async () => {
    if (!pendingRemoveMatchId || removeConfirmLoading) return
    setRemoveConfirmLoading(true)
    const success = await deleteMatch(pendingRemoveMatchId)
    setRemoveConfirmLoading(false)
    if (success) {
      setRemoveConfirmVisible(false)
      setPendingRemoveMatchId(null)
    }
  }

  const handleDecisionSelect = (action: string) => {
    if (action === "change") {
      setView("documents")
      return
    }
    if (action === "remove") {
      openRemoveConfirm()
    }
  }

  const deleteMatch = async (matchRowId: number) => {
    console.log("[panel] deleteMatch triggered", { matchRowId })
    try {
      const response = await fetch(
        `${backendBase.replace(/\/+$/, "")}/api/page-match?page_match_id=${matchRowId}`,
        {
          method: "DELETE",
        }
      )
      console.log("[panel] delete-page-match response status", response.status)
      if (!response.ok) {
        const payload = await response.text()
        console.log("[panel] delete-page-match body", payload)
        throw new Error(`Failed to delete match (${response.status}): ${payload}`)
      }
      console.log("[panel] match deleted", matchRowId)
      chrome.runtime.sendMessage({ action: "removeMatchHighlight", page_match_id: matchRowId })
      setDecisionCardVisible(false)
      setMatch(null)
      return true
    } catch (error) {
      console.error("[panel] delete match error", error)
      setToastMessage("Unable to delete match")
      return false
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

  useEffect(() => {
    if (activeSection === "new-match") {
      newMatchModeRef.current = true
      setSelectedNewMatchText(null)
      resetManualFlow()
      chrome.runtime.sendMessage({ action: "enterNewMatchMode" })
    } else if (newMatchModeRef.current) {
      newMatchModeRef.current = false
      chrome.runtime.sendMessage({ action: "exitNewMatchMode" })
    }
  }, [activeSection])

  const handleChooseManually = () => {
    if (!selectedNewMatchText) {
      setToastMessage("Highlight text first to choose manually")
      return
    }
    setToastMessage("Opening clip picker…")
    startManualFlow()
  }

  const handleStartOver = () => {
    setAutoMatchResults([])
    setAutoMatchLoading(false)
    setToastMessage("New match mode reset")
    console.log("[panel] start over clicked, cleared matches")
    setSelectedNewMatchText(null)
    resetManualFlow()
    chrome.runtime.sendMessage({ action: "exitNewMatchMode" })
    window.setTimeout(() => {
      chrome.runtime.sendMessage({ action: "enterNewMatchMode" })
    }, 0)
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

  useEffect(() => {
    return () => {
      chrome.runtime.sendMessage({ action: "exitNewMatchMode" })
    }
  }, [])

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

  const renderNewMatchFlow = () => {
    switch (manualStage) {
      case "documents":
        return (
          <div className="new-match-documents">
            <div className="new-match-documents__header">Choose a clip</div>
            {selectedNewMatchText && (
              <div className="new-match-documents__phrase">{selectedNewMatchText}</div>
            )}
            <ProviderDocumentsGrid onDocumentSelect={handleManualDocumentSelect} />
            <div className="new-match-documents__actions">
              <button
                type="button"
                className="new-match-documents__button new-match-documents__button--primary"
                onClick={handleStartOver}
              >
                <span aria-hidden="true" className="new-match-documents__start-icon">
                  <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" viewBox="0 0 16 16">
                    <path fillRule="evenodd" d="M8 3a5 5 0 1 0 4.546 2.914.5.5 0 0 1 .908-.417A6 6 0 1 1 8 2z"/>
                    <path d="M8 4.466V.534a.25.25 0 0 1 .41-.192l2.36 1.966c.12.1.12.284 0 .384L8.41 4.658A.25.25 0 0 1 8 4.466"/>
                  </svg>
                </span>
                Start over
              </button>
              <button
                type="button"
                className="new-match-documents__button new-match-documents__button--secondary"
                onClick={() => {
                  setManualStage("prompt")
                  handleGetMatches()
                }}
              >
                <span aria-hidden="true" className="new-match-documents__star-icon">
                  <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" viewBox="0 0 16 16">
                    <path d="M7.657 6.247c.11-.33.576-.33.686 0l.645 1.937a2.89 2.89 0 0 0 1.829 1.828l1.936.645c.33.11.33.576 0 .686l-1.937.645a2.89 2.89 0 0 0-1.828 1.829l-.645 1.936a.361.361 0 0 1-.686 0l-.645-1.937a2.89 2.89 0 0 0-1.828-1.828l-1.937-.645a.361.361 0 0 1 0-.686l1.937-.645a2.89 2.89 0 0 0 1.828-1.828zM3.794 1.148a.217.217 0 0 1 .412 0l.387 1.162c.173.518.579.924 1.097 1.097l1.162.387a.217.217 0 0 1 0 .412l-1.162.387A1.73 1.73 0 0 0 4.593 5.69l-.387 1.162a.217.217 0 0 1-.412 0L3.407 5.69A1.73 1.73 0 0 0 2.31 4.593l-1.162-.387a.217.217 0 0 1 0-.412l1.162-.387A1.73 1.73 0 0 0 3.407 2.31zM10.863.099a.145.145 0 0 1 .274 0l.258.774c.115.346.386.617.732.732l.774.258a.145.145 0 0 1 0 .274l-.774.258a1.16 1.16 0 0 0-.732.732l-.258.774a.145.145 0 0 1-.274 0l-.258-.774a1.16 1.16 0 0 0-.732-.732L9.1 2.137a.145.145 0 0 1 0-.274l.774-.258c.346-.115.617-.386.732-.732z"/>
                  </svg>
                </span>
                Best matches
              </button>
            </div>
          </div>
        )
      case "timestamp":
        return manualSelectedDoc ? (
          <TimestampView
            document={manualSelectedDoc}
            videoUrl={manualSelectedDoc.source_url}
            onBack={handleManualBackToDocuments}
            onConfirm={handleManualTimestampConfirm}
          />
        ) : null
      default:
        return (
        <NewMatchPrompt
          selectedText={selectedNewMatchText}
          onGetMatches={handleGetMatches}
          onChooseManually={handleChooseManually}
          onReset={handleStartOver}
          matchResults={autoMatchResults}
          loadingMatches={autoMatchLoading}
          onSelectMatch={handleSelectMatchSuggestion}
        />
        )
    }
  }

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
      case "page": {
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
      }
      case "threshold": {
        return (
          <ThresholdControls
            current={threshold}
            onChange={handleThresholdChange}
            onSave={saveThresholdMatches}
            saving={thresholdSaving}
          />
        )
      }
      case "sitemap": {
        return (
          <SitemapView
            providerId={PROVIDER_ID}
            onFeedToggle={handleFeedToggle}
            onPageToggle={handlePageToggle}
          />
        )
      }
      case "new-match": {
        return renderNewMatchFlow()
      }
      default: {
        return null
      }
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
      <ConfirmAction
        visible={removeConfirmVisible}
        title="Delete match?"
        message="Deleting this match is permanent and cannot be reversed."
        confirmLabel="Delete"
        confirmLoadingLabel="Deleting..."
        confirmDisabled={removeConfirmLoading}
        onConfirm={handleConfirmRemoval}
        onCancel={closeRemoveConfirm}
      />
    </div>
  )
}

export default SidePanel
