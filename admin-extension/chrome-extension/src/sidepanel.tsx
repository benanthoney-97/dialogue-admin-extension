import { useEffect, useState, useRef } from "react"
import "./style.css"
import { DecisionCard } from "./components/decision-card"
import type { DecisionCardProps } from "./components/decision-card"
import { ProviderDocumentsGrid } from "./components/provider-documents-grid"
import type { ProviderDocument } from "./components/provider-documents-grid"
import { PageSummary } from "./components/page-summary"
import { BottomNavigation } from "./components/bottom-navigation"
import { SitemapView } from "./components/sitemap-view"
import { TimestampView } from "./components/timestamp-view"
import { NewMatchPrompt, SelectedTextBlock } from "./components/new-match-prompt"
import { ConfirmAction } from "./components/confirm-action"
import { LoginForm } from "./components/login-form/login-form"
import { LibraryDocumentsGrid } from "./components/library-documents-grid"
import type { LibraryDocument } from "./components/library-documents-grid"
import { SingleViewVideo } from "./components/single-view-video"
import type { SitemapFeed } from "./components/sitemap-feeds-table"
import { LibraryProvidersGrid, type LibraryProvider } from "./components/library-providers-grid"
import { AccountView } from "./components/account-view"
import { AnalyticsView } from "./components/analytics-view"
import { supabase } from "./lib/supabase"
import {
  THRESHOLD_DEFAULT,
  THRESHOLD_DISPLAY,
  THRESHOLD_STEP,
  clampThresholdValue,
  determineThresholdLevel,
} from "./utils/threshold"

const toNumber = (value: unknown) => {
  if (typeof value === "number" && !Number.isNaN(value)) {
    return value
  }
  if (typeof value === "string" && value.trim() !== "") {
    const parsed = Number(value)
    return Number.isNaN(parsed) ? undefined : parsed
  }
  return undefined
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
  knowledge_metadata?: Record<string, unknown>
  page_url?: string
}

type DecisionContext = "page" | "video"

type NavSection = "page" | "sitemap" | "new-match" | "library" | "measure" | "account"

function SidePanel() {
  const [match, setMatch] = useState<MatchPayload | null>(null)
  const [view, setView] = useState<"documents" | "timestamp" | null>(null)
  const [selectedDoc, setSelectedDoc] = useState<ProviderDocument | null>(null)
  const [thresholdValue, setThresholdValue] = useState(THRESHOLD_DEFAULT)
  const [activeSection, setActiveSection] = useState<NavSection>("page")
  const [toastMessage, setToastMessage] = useState<string | null>(null)
  const toastTimerRef = useRef<number | null>(null)
  const thresholdUpdateTimerRef = useRef<number | null>(null)
  const lastAppliedThresholdRef = useRef<number>(THRESHOLD_DEFAULT)
  const [decisionCardVisible, setDecisionCardVisible] = useState(false)
  const [decisionCardBackLabel, setDecisionCardBackLabel] = useState("Back")
  const [decisionCardBackAriaLabel, setDecisionCardBackAriaLabel] =
    useState("Back to page summary")
  const [removeConfirmVisible, setRemoveConfirmVisible] = useState(false)
  const [removeConfirmLoading, setRemoveConfirmLoading] = useState(false)
  const [pendingRemoveMatchId, setPendingRemoveMatchId] = useState<number | null>(null)
  const [selectedNewMatchText, setSelectedNewMatchText] = useState<string | null>(null)
  const [manualStage, setManualStage] = useState<"prompt" | "documents" | "timestamp">("prompt")
  const [manualSelectedDoc, setManualSelectedDoc] = useState<ProviderDocument | null>(null)
  const [manualLibraryTab, setManualLibraryTab] = useState<"provider" | "marketplace">("provider")
  const [manualLibraryProviderId, setManualLibraryProviderId] = useState<number | null>(null)
  const [manualLibraryProviderName, setManualLibraryProviderName] = useState<string | null>(null)
  const [autoMatchResults, setAutoMatchResults] = useState<any[]>([])
  const [autoMatchLoading, setAutoMatchLoading] = useState(false)
  const [libraryDocument, setLibraryDocument] = useState<LibraryDocument | null>(null)
  const [selectedLibraryProviderId, setSelectedLibraryProviderId] = useState<number | null>(null)
  const [selectedLibraryProviderName, setSelectedLibraryProviderName] = useState<string | null>(null)
  const [libraryTab, setLibraryTab] = useState<"provider" | "marketplace">("provider")
  const [providerName, setProviderName] = useState<string | null>(null)
  const [providerLogoUrl, setProviderLogoUrl] = useState<string | null>(null)
  const [pageSummarySlideActive, setPageSummarySlideActive] = useState(false)
  const pageSummarySlideTimerRef = useRef<number | null>(null)
  const [sitemapBreadcrumbVisible, setSitemapBreadcrumbVisible] = useState(false)
  const [pageNewMatchVisible, setPageNewMatchVisible] = useState(false)
const backendBase = process.env.PLASMO_PUBLIC_BACKEND_URL;  
const newMatchModeRef = useRef(false)
  const [authToken, setAuthToken] = useState<string | null>(null)
  const [authEmail, setAuthEmail] = useState<string | null>(null)
  const [providerId, setProviderId] = useState<number | null>(null)

  const resolveProviderId = () => {
    if (process.env.NODE_ENV !== "production") {
    }
    return providerId
  }
  const [authLoading, setAuthLoading] = useState(false)

  useEffect(() => {
    const port = chrome.runtime.connect({ name: "admin-mode" })
    return () => {
      port.disconnect()
    }
  }, [])

  useEffect(() => {
    return () => {
      if (thresholdUpdateTimerRef.current) {
        window.clearTimeout(thresholdUpdateTimerRef.current)
        thresholdUpdateTimerRef.current = null
      }
    }
  }, [])

  useEffect(() => {
    return () => {
      if (pageSummarySlideTimerRef.current) {
        window.clearTimeout(pageSummarySlideTimerRef.current)
        pageSummarySlideTimerRef.current = null
      }
    }
  }, [])

  useEffect(() => {
    const listener = (message: any) => {
      if (message.action === "matchClicked") {
        setMatch(message.match)
        setDecisionCardVisible(true)
      } else if (message.action === "matchData") {
        setMatch(message.match)
      } else if (message.action === "thresholdData") {
        const rawValue = message.thresholdValue ?? message.threshold
        const numericValue = toNumber(rawValue)
        if (typeof numericValue === "number") {
          const clamped = clampThresholdValue(numericValue)
          setThresholdValue(clamped)
          chrome.storage?.local?.set?.({ threshold: clamped })
        }
      } else if (message.action === "deliverNewMatchSelection") {
        if (message.text) {
          setSelectedNewMatchText(message.text)
          setToastMessage("Text captured")
        }
      }
    }

    chrome.runtime.onMessage.addListener(listener)

    chrome.runtime.sendMessage({ action: "getLatestMatch" }, (response) => {
      if (response?.match) {
        setMatch(response.match)
      }
    })

    return () => {
      chrome.runtime.onMessage.removeListener(listener)
    }
  }, [])

  useEffect(() => {
    chrome.storage?.local?.get?.({ threshold: THRESHOLD_DEFAULT }, (result) => {
      const stored = clampThresholdValue(toNumber(result?.threshold) ?? THRESHOLD_DEFAULT)
      setThresholdValue(stored)
      lastAppliedThresholdRef.current = stored
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
    knowledgeMetadata: match?.knowledge_metadata ?? null,
    providerId: match?.provider_id ?? null,
    pageUrl: match?.url ?? match?.page_url ?? null,
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

  const resetManualLibrarySelection = () => {
    setManualLibraryTab("provider")
    setManualLibraryProviderId(null)
    setManualLibraryProviderName(null)
  }

  const handleManualLibraryProviderSelect = (provider: LibraryProvider) => {
    setManualLibraryProviderId(provider.id)
    setManualLibraryProviderName(provider.name ?? null)
    setManualLibraryTab("provider")
  }

  const handleManualLibraryProvidersBack = () => {
    setManualLibraryProviderId(null)
    setManualLibraryProviderName(null)
    setManualLibraryTab("marketplace")
  }

  const resetManualFlow = () => {
    setManualStage("prompt")
    setManualSelectedDoc(null)
    resetManualLibrarySelection()
  }

  const startManualFlow = () => {
    setManualStage("documents")
    setManualSelectedDoc(null)
    resetManualLibrarySelection()
  }

  const enterNewMatchMode = () => {
    newMatchModeRef.current = true
    setSelectedNewMatchText(null)
    resetManualFlow()
    chrome.runtime.sendMessage({ action: "enterNewMatchMode" })
  }

  const openPageNewMatchPrompt = () => {
    setPageNewMatchVisible(true)
    enterNewMatchMode()
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
          provider_id: resolveProviderId(),
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
      setToastMessage("Unable to load match suggestions")
    } finally {
      setAutoMatchLoading(false)
    }
  }

  const handleSelectMatchSuggestion = async (result: any) => {
    if (!selectedNewMatchText) {
      setToastMessage("Highlight text to save a match")
      return
    }
    const docId = Number(result.document_id || result.documentId || 0)
    if (!docId) {
      setToastMessage("Unable to determine document for this match")
      return
    }
    const normalizedUrl = buildVideoUrl(result.video_url || result.source_url || result.videoUrl, result.timestamp_start ?? result.timestampStart ?? 0)
    const timestampValue =
      typeof result.timestamp_start === "number"
        ? result.timestamp_start
        : typeof result.timestampStart === "number"
        ? result.timestampStart
        : typeof result.timestamp === "number"
        ? result.timestamp
        : null
    const endpoint = `${backendBase.replace(/\/+$/, "")}/api/create-page-match`

    try {
      const response = await fetch(endpoint, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          document_id: docId,
          provider_id: resolveProviderId(),
          source_provider_id: resolveProviderId(),
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
      setToastMessage("Unable to save match")
    }
  }

  useEffect(() => {
    setAutoMatchResults([])
  }, [selectedNewMatchText])

  useEffect(() => {
    if (!providerId) {
      setProviderName(null)
      setProviderLogoUrl(null)
      return
    }
    let canceled = false
    const fetchName = async () => {
      try {
        const { data, error } = await supabase
          .from("providers")
          .select("name, logo_url")
          .eq("id", providerId)
          .single()
        if (canceled) return
        if (error) {
          throw error
        }
        setProviderName(data?.name ?? null)
        setProviderLogoUrl(data?.logo_url ?? null)
      } catch (err) {
        if (canceled) return
        console.error("[sidepanel] failed to load provider name", err)
      }
    }
    void fetchName()
    return () => {
      canceled = true
    }
  }, [providerId])

  useEffect(() => {
    if (activeSection !== "library") {
      setLibraryDocument(null)
      setSelectedLibraryProviderId(null)
      setSelectedLibraryProviderName(null)
    }
  }, [activeSection])

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
    const selectedProviderForKnowledge = manualLibraryProviderId ?? resolveProviderId()
    try {
      const response = await fetch(endpoint, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          document_id: manualSelectedDoc.id,
          provider_id: resolveProviderId(),
          source_provider_id: selectedProviderForKnowledge,
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
      setToastMessage("Match saved")
      setManualStage("prompt")
      setManualSelectedDoc(null)
      setSelectedNewMatchText(null)
      chrome.runtime.sendMessage({ action: "restoreMatchHighlight", match: createdMatch })
      setActiveSection("page")
      setMatch(createdMatch)
      setDecisionCardVisible(true)
      chrome.runtime.sendMessage({ action: "exitNewMatchMode" })
      newMatchModeRef.current = false
    } catch (error) {
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
    try {
      const response = await fetch(
        `${backendBase.replace(/\/+$/, "")}/api/page-match?page_match_id=${matchRowId}`,
        {
          method: "DELETE",
        }
      )
      if (!response.ok) {
        const payload = await response.text()
        throw new Error(`Failed to delete match (${response.status}): ${payload}`)
      }
      chrome.runtime.sendMessage({ action: "removeMatchHighlight", page_match_id: matchRowId })
      setDecisionCardVisible(false)
      setMatch(null)
      return true
    } catch (error) {
      setToastMessage("Unable to delete match")
      return false
    }
  }

  const handleDocumentSelect = (doc: ProviderDocument) => {
    setSelectedDoc(doc)
    setView("timestamp")
  }

  const handleLibraryDocumentSelect = (doc: LibraryDocument) => {
    setLibraryDocument(doc)
  }

  const handleLibraryTabChange = (tab: "provider" | "marketplace") => {
    setLibraryTab(tab)
    setSelectedLibraryProviderId(null)
    setSelectedLibraryProviderName(null)
  }

  const handleLibraryProviderSelect = (provider: LibraryProvider) => {
    setSelectedLibraryProviderId(provider.id)
    setSelectedLibraryProviderName(provider.name ?? null)
    setLibraryDocument(null)
    setLibraryTab("marketplace")
  }

  const handleLibraryProvidersBack = () => {
    setSelectedLibraryProviderId(null)
    setSelectedLibraryProviderName(null)
    setLibraryDocument(null)
    setLibraryTab("marketplace")
  }

  const handleThresholdChange = (value: number) => {
    const clamped = clampThresholdValue(value)
    setThresholdValue(clamped)
    chrome.storage?.local?.set?.({ threshold: clamped })
    console.log("[sl-panel] handleThresholdChange clamped", clamped)
    if (thresholdUpdateTimerRef.current) {
      window.clearTimeout(thresholdUpdateTimerRef.current)
    }
    thresholdUpdateTimerRef.current = window.setTimeout(() => {
      if (lastAppliedThresholdRef.current === clamped) {
        thresholdUpdateTimerRef.current = null
        return
      }
      lastAppliedThresholdRef.current = clamped
      chrome.runtime.sendMessage({ action: "setThreshold", thresholdValue: clamped })
      const label = THRESHOLD_DISPLAY[determineThresholdLevel(clamped)].title
      setToastMessage(`Updated to ${label}`)
      thresholdUpdateTimerRef.current = null
    }, 250)
  }

  const handleFeedToggle = async (feedId: number, tracked: boolean) => {
    try {
      await fetch(`${backendBase.replace(/\/+$/, "")}/api/sitemap-feed-status`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ feed_id: feedId, tracked }),
      })
    } catch (error) {
    }
  }

  const handlePageToggle = async (pageId: number, tracked: boolean) => {
    try {
      const response = await fetch(`${backendBase.replace(/\/+$/, "")}/api/sitemap-page-status`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ page_id: pageId, tracked }),
      })
      const data = await response.json().catch(() => null)
      setToastMessage(tracked ? "Matches are live on this page!" : "Matches hidden on this page")
    } catch (error) {
      setToastMessage("Unable to update page tracking")
    }
  }

  const [lastViewedFeed, setLastViewedFeed] = useState<SitemapFeed | null>(null)

  const handlePageSummaryRefresh = () => {
    if (process.env.NODE_ENV !== "production") {
    }
    setPageSummaryUrl(null)
  }

  const triggerPageSummarySlide = (pageUrl: string, feed: SitemapFeed) => {
    setActiveSection("page")
    setDecisionCardVisible(false)
    setView(null)
    setPageSummaryUrl(pageUrl)
    const scheduleAnimation = () => {
      if (pageSummarySlideTimerRef.current) {
        window.clearTimeout(pageSummarySlideTimerRef.current)
        pageSummarySlideTimerRef.current = null
      }
      setPageSummarySlideActive(false)
      const start = () => {
        setPageSummarySlideActive(true)
        pageSummarySlideTimerRef.current = window.setTimeout(() => {
          setPageSummarySlideActive(false)
          pageSummarySlideTimerRef.current = null
        }, 600)
      }
      setSitemapBreadcrumbVisible(true)
      if (typeof window !== "undefined" && typeof window.requestAnimationFrame === "function") {
        window.requestAnimationFrame(start)
      } else {
        start()
      }
    }
    setLastViewedFeed(feed)
    scheduleAnimation()
  }

  const handleReturnToSitemap = () => {
    setActiveSection("sitemap")
    setDecisionCardVisible(false)
    setView(null)
    setSitemapBreadcrumbVisible(false)
    setPageSummaryUrl(null)
  }

  useEffect(() => {
        if (activeSection === "new-match") {
          if (!newMatchModeRef.current) {
            enterNewMatchMode()
          }
          return
    }
    if (newMatchModeRef.current) {
      newMatchModeRef.current = false
      chrome.runtime.sendMessage({ action: "exitNewMatchMode" })
    }
  }, [activeSection])

  useEffect(() => {
    if (activeSection !== "page") {
      setPageNewMatchVisible(false)
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
    setSelectedNewMatchText(null)
    resetManualFlow()
    chrome.runtime.sendMessage({ action: "exitNewMatchMode" })
    setPageNewMatchVisible(false)
  }

  const handleNewMatchPromptReset = () => {
    setAutoMatchResults([])
    setAutoMatchLoading(false)
    setToastMessage("New match prompt reset")
    openPageNewMatchPrompt()
  }

  const handleMatchSelect = async (pageMatchId: number, context: DecisionContext = "page") => {
    if (!pageMatchId) return
    const backLabel = context === "video" ? "Back to video" : "Back"
    const backAriaLabel = context === "video" ? "Back to video" : "Back to page summary"
    setDecisionCardBackLabel(backLabel)
    setDecisionCardBackAriaLabel(backAriaLabel)
    try {
      const matchEndpoint = `${backendBase.replace(/\/+$/, "")}/api/page-match?page_match_id=${pageMatchId}`
      const pageMatchResponse = await fetch(matchEndpoint)
      if (!pageMatchResponse.ok) {
        const text = await pageMatchResponse.text()
        throw new Error(`Failed to load match (${pageMatchResponse.status}): ${text}`)
      }
      const pageMatch = await pageMatchResponse.json()

      const knowledgeId = pageMatch?.knowledge_id ?? ""
      const documentId = pageMatch?.document_id ?? ""
      const decisionEndpoint = `${backendBase.replace(/\/+$/, "")}/api/decision-data?provider_id=${resolveProviderId()}&page_match_id=${pageMatchId}${
        documentId ? `&document_id=${documentId}` : ""
      }${knowledgeId ? `&knowledge_id=${knowledgeId}` : ""}`
      const decisionResponse = await fetch(decisionEndpoint)
      const decisionData = decisionResponse.ok ? await decisionResponse.json() : {}

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

      setMatch(merged)
      setDecisionCardVisible(true)
      setView(null)
    } catch (error) {
    }
  }

  useEffect(() => {
    if (activeSection !== "page") {
      setPageSummarySlideActive(false)
      setSitemapBreadcrumbVisible(false)
    }
  }, [activeSection])

  useEffect(() => {
    return () => {
      chrome.runtime.sendMessage({ action: "exitNewMatchMode" })
    }
  }, [])

  const handleDecisionBack = () => {
    setDecisionCardVisible(false)
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

  const toVimeoPlayerEmbedUrl = (sourceUrl?: string, seconds?: number) => {
    if (!sourceUrl) return ""
    const normalizedSeconds =
      typeof seconds === "number" && Number.isFinite(seconds) ? Math.max(0, Math.round(seconds)) : null
    const cleaned = sourceUrl.split("#")[0]
    const patterns = [/player\.vimeo\.com\/video\/(\d+)/, /vimeo\.com\/(\d+)/]
    let videoId: string | null = null
    for (const pattern of patterns) {
      const match = cleaned.match(pattern)
      if (match) {
        videoId = match[1]
        break
      }
    }
    const suffix = normalizedSeconds ? `#t=${normalizedSeconds}s` : ""
    if (!videoId) {
      return cleaned + suffix
    }
    return `https://player.vimeo.com/video/${videoId}?autoplay=1&muted=1&title=0&byline=0&portrait=0${suffix}`
  }

  const buildVideoUrl = (sourceUrl?: string, seconds?: number) => {
    return toVimeoPlayerEmbedUrl(sourceUrl, seconds)
  }

  const handleTimestampConfirm = async (seconds: number) => {
    if (!selectedDoc) {
      setView(null)
      return
    }
    if (!match?.page_match_id) {
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
    } finally {
      setView(null)
    }
  }

  const [currentTabUrl, setCurrentTabUrl] = useState<string | null>(null)
  const [pageSummaryUrl, setPageSummaryUrl] = useState<string | null>(null)

  useEffect(() => {
    let canceled = false

    const resolveActiveTabUrl = () => {
      chrome.tabs?.query?.({ active: true, currentWindow: true }, (tabs) => {
        if (canceled) return
        if (tabs && tabs.length > 0 && tabs[0]?.url) {
          setCurrentTabUrl(tabs[0].url)
        }
      })
    }

    const handleTabActivated = () => {
      resolveActiveTabUrl()
      if (process.env.NODE_ENV !== "production") {
      }
    }

    const handleTabUpdated = (_tabId: number, changeInfo: chrome.tabs.TabChangeInfo, tab: chrome.tabs.Tab) => {
      if (!tab || !tab.active) return
      const maybeUrl = changeInfo.url || tab.url
      if (maybeUrl) {
        if (process.env.NODE_ENV !== "production") {
        }
        setCurrentTabUrl(maybeUrl)
      }
    }

    resolveActiveTabUrl()
    chrome.tabs?.onActivated?.addListener(handleTabActivated)
    chrome.tabs?.onUpdated?.addListener(handleTabUpdated)

    return () => {
      canceled = true
      chrome.tabs?.onActivated?.removeListener(handleTabActivated)
      chrome.tabs?.onUpdated?.removeListener(handleTabUpdated)
    }
  }, [])

  useEffect(() => {
    if (currentTabUrl && pageSummaryUrl && currentTabUrl !== pageSummaryUrl) {
      if (process.env.NODE_ENV !== "production") {
      }
      setPageSummaryUrl(null)
    }
  }, [currentTabUrl, pageSummaryUrl])

  useEffect(() => {
    if (process.env.NODE_ENV !== "production") {
    }
  }, [currentTabUrl, pageSummaryUrl])

  const fallbackMatchUrl =
    match?.url || match?.source_url || match?.document_title || null
  const pageUrl = (fallbackMatchUrl || currentTabUrl || "Current page") as string
  const resolvedPageUrl = pageSummaryUrl ?? currentTabUrl ?? pageUrl

  useEffect(() => {
    if (match) {
    }
  }, [match, pageUrl])

  const renderNewMatchFlow = () => {
    switch (manualStage) {
      case "documents": {
        const providerTabLabel = "Your Library"
        const resolvedProviderId = resolveProviderId()
        return (
          <div className="new-match-documents">
            <SelectedTextBlock
              text={selectedNewMatchText}
              onReset={handleNewMatchPromptReset}
              className="new-match-documents__selection"
            />
            <div className="new-match-documents__library">
              <div className="library-main-shell">
                <div className="library-providers-shell">
                  {manualLibraryProviderId ? (
                    <div className="library-documents-shell">
                      <div className="library-documents-header">
                        <button
                          type="button"
                          className="library-documents-back"
                          onClick={handleManualLibraryProvidersBack}
                          aria-label="Back to providers"
                        >
                          <svg
                            xmlns="http://www.w3.org/2000/svg"
                            width="16"
                            height="16"
                            fill="currentColor"
                            viewBox="0 0 16 16"
                            aria-hidden="true"
                          >
                            <path
                              fillRule="evenodd"
                              d="M15 8a.5.5 0 0 0-.5-.5H2.707l3.147-3.146a.5.5 0 1 0-.708-.708l-4 4a.5.5 0 0 0 0 .708l4 4a.5.5 0 0 0 .708-.708L2.707 8.5H14.5A.5.5 0 0 0 15 8"
                            />
                          </svg>
                          <span className="sr-only">Back to providers</span>
                        </button>
                        <div>
                          <div className="library-documents-title">
                            {manualLibraryProviderName ?? "Provider library"}
                          </div>
                        </div>
                      </div>
                      <LibraryDocumentsGrid
                        providerId={manualLibraryProviderId}
                        onDocumentSelect={handleManualDocumentSelect}
                        showChooseTime
                      />
                    </div>
                  ) : (
                    <>
                      <div className="library-tabs-pill">
                        <button
                          type="button"
                          className={`library-tabs-pill__button${manualLibraryTab === "provider" ? " library-tabs-pill__button--active" : ""}`}
                          onClick={() => setManualLibraryTab("provider")}
                        >
                          {providerTabLabel}
                        </button>
                        <button
                          type="button"
                          className={`library-tabs-pill__button${manualLibraryTab === "marketplace" ? " library-tabs-pill__button--active" : ""}`}
                          onClick={() => setManualLibraryTab("marketplace")}
                        >
                          Marketplace
                        </button>
                      </div>
                      {manualLibraryTab === "provider" ? (
                        resolvedProviderId ? (
                          <LibraryDocumentsGrid
                            providerId={resolvedProviderId}
                            onDocumentSelect={handleManualDocumentSelect}
                            showChooseTime
                          />
                        ) : (
                          <div className="panel__loading">
                            <span>Loading provider data…</span>
                          </div>
                        )
                      ) : (
                        <LibraryProvidersGrid
                          excludeProviderId={resolvedProviderId ?? undefined}
                          onSelect={handleManualLibraryProviderSelect}
                        />
                      )}
                    </>
                  )}
                </div>
              </div>
            </div>
          </div>
        )
      }
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
          onReset={handleNewMatchPromptReset}
          matchResults={autoMatchResults}
          loadingMatches={autoMatchLoading}
          onSelectMatch={handleSelectMatchSuggestion}
        />
        )
    }
  }

  const renderAuthenticatedContent = () => {
    if (view === "documents") {
      return (
        <ProviderDocumentsGrid
          providerId={resolveProviderId()}
          onDocumentSelect={handleDocumentSelect}
        />
      )
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
              backLabel={decisionCardBackLabel}
              backAriaLabel={decisionCardBackAriaLabel}
              onDecisionSelect={handleDecisionSelect}
              onBack={handleDecisionBack}
            />
          </div>
        ) : (
          <div className={`page-summary-panel${pageSummarySlideActive ? " page-summary-panel--animate" : ""}`}>
            <div className="page-summary-panel__container">
              <PageSummary
                pageUrl={resolvedPageUrl}
                providerId={resolveProviderId()}
                onMatchSelect={handleMatchSelect}
                showBackToList={sitemapBreadcrumbVisible}
                onReturnToSitemap={handleReturnToSitemap}
                onRefresh={handlePageSummaryRefresh}
                onNewMatch={openPageNewMatchPrompt}
              />
              {pageNewMatchVisible && (
                <div className="page-new-match-overlay">
                  {manualStage === "prompt" && (
                    <button
                      type="button"
                      className="page-new-match-overlay__close"
                      onClick={handleStartOver}
                      aria-label="Close new match"
                    >
                      <svg
                        xmlns="http://www.w3.org/2000/svg"
                        width="16"
                        height="16"
                        fill="currentColor"
                        className="bi bi-x-lg"
                        viewBox="0 0 16 16"
                      >
                        <path d="M2.146 2.854a.5.5 0 1 1 .708-.708L8 7.293l5.146-5.147a.5.5 0 0 1 .708.708L8.707 8l5.147 5.146a.5.5 0 0 1-.708.708L8 8.707l-5.146 5.147a.5.5 0 0 1-.708-.708L7.293 8z"/>
                      </svg>
                    </button>
                  )}
                  {renderNewMatchFlow()}
                </div>
              )}
            </div>
          </div>
        )
      }
      case "sitemap": {
        return (
          <SitemapView
            providerId={resolveProviderId()}
            onFeedToggle={handleFeedToggle}
            onPageToggle={handlePageToggle}
            onViewPage={triggerPageSummarySlide}
            initialSelectedFeed={lastViewedFeed}
            thresholdValue={thresholdValue}
            onThresholdChange={handleThresholdChange}
          />
        )
      }
      case "library": {
        if (decisionCardVisible && match) {
          return (
            <div className="decision-card-shell">
              <DecisionCard
                {...cardProps}
                backLabel={decisionCardBackLabel}
                backAriaLabel={decisionCardBackAriaLabel}
                onDecisionSelect={handleDecisionSelect}
                onBack={handleDecisionBack}
              />
            </div>
          )
        }
        const providerTabLabel = "Your Library"
        if (selectedLibraryProviderId) {
          return (
            <div className="library-main-shell">
              <div className="library-documents-shell">
                <div className="library-documents-header">
                        <button
                          type="button"
                          className="library-documents-back"
                          onClick={handleLibraryProvidersBack}
                          aria-label="Back to providers"
                        >
                          <svg
                            xmlns="http://www.w3.org/2000/svg"
                            width="16"
                            height="16"
                            fill="currentColor"
                            viewBox="0 0 16 16"
                            aria-hidden="true"
                          >
                            <path
                              fillRule="evenodd"
                              d="M15 8a.5.5 0 0 0-.5-.5H2.707l3.147-3.146a.5.5 0 1 0-.708-.708l-4 4a.5.5 0 0 0 0 .708l4 4a.5.5 0 0 0 .708-.708L2.707 8.5H14.5A.5.5 0 0 0 15 8"
                            />
                          </svg>
                          <span className="sr-only">Back to providers</span>
                        </button>
                        <div>
                          <div className="library-documents-title">
                            {selectedLibraryProviderName ?? "Provider library"}
                          </div>
                        </div>
                </div>
                <LibraryDocumentsGrid
                  providerId={selectedLibraryProviderId}
                  onDocumentSelect={handleLibraryDocumentSelect}
                />
              </div>
            </div>
          )
        }
        return (
          <div className="library-main-shell">
            <div className="library-providers-shell">
              <div className="library-providers-shell__header">
                <div className="library-providers-shell__title">Video library</div>
                <p className="library-providers-shell__subtitle">
                  Pick a provider to explore its video library.
                </p>
              </div>
              <div className="library-tabs-pill">
                <button
                  type="button"
                  className={`library-tabs-pill__button${libraryTab === "provider" ? " library-tabs-pill__button--active" : ""}`}
                  onClick={() => handleLibraryTabChange("provider")}
                >
                  {providerTabLabel}
                </button>
                <button
                  type="button"
                  className={`library-tabs-pill__button${libraryTab === "marketplace" ? " library-tabs-pill__button--active" : ""}`}
                  onClick={() => handleLibraryTabChange("marketplace")}
                >
                  Marketplace
                </button>
              </div>
              {libraryTab === "provider" ? (
                providerId ? (
                  <LibraryDocumentsGrid providerId={providerId} onDocumentSelect={handleLibraryDocumentSelect} />
                ) : (
                  <div className="panel__loading">
                    <span>Loading provider data…</span>
                  </div>
                )
              ) : (
                <LibraryProvidersGrid
                  excludeProviderId={providerId ?? undefined}
                  onSelect={handleLibraryProviderSelect}
                />
              )}
            </div>
          </div>
        )
      }
      case "new-match": {
        return renderNewMatchFlow()
      }
      case "account": {
        return <AccountView email={authEmail} logoUrl={providerLogoUrl} />
      }
      case "measure": {
        return <AnalyticsView />
      }
      default: {
        return null
      }
    }
  }

  useEffect(() => {
    chrome.storage?.local?.get?.({ authToken: null, authEmail: null, providerId: null }, (result) => {
      setAuthToken(result.authToken || null)
      setAuthEmail(result.authEmail || null)
      if (result?.providerId) {
        const num = toNumber(result.providerId)
        setProviderId(num ?? null)
      }
    })
  }, [])

  const saveAuth = (token: string, email: string, providerId: number | null) => {
    setAuthToken(token)
    setAuthEmail(email)
    if (process.env.NODE_ENV !== "production") {
    }
    chrome.storage?.local?.set?.({ authToken: token, authEmail: email, providerId }, () => {
      setProviderId(providerId)
    })
  }

  const renderContent = () => {
    if (!authToken) {
      return (
        <div className="login-panel">
          <LoginForm
          onRequestOtp={async (email) => {
            setAuthLoading(true)
            try {
              await fetch(`${backendBase}/api/auth/request-otp`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ email }),
              })
            } finally {
              setAuthLoading(false)
            }
          }}
          onVerifyOtp={async (email, otp) => {
            setAuthLoading(true)
            try {
              const response = await fetch(`${backendBase}/api/auth/verify-otp`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ email, otp }),
              })
              if (!response.ok) throw new Error("Invalid OTP")
              const data = await response.json()
              if (process.env.NODE_ENV !== "production") {
              }
              saveAuth(data.token, data.email, toNumber(data.provider_id))
            } finally {
              setAuthLoading(false)
            }
          }}
          />
        </div>
      )
    }

    if (!providerId) {
      return (
        <div className="panel__loading">
          <span>Loading provider data…</span>
        </div>
      )
    }
    return (
      <div className="flex h-screen w-full flex-col bg-transparent font-sans text-slate-900">
        {toastMessage && <div className="panel-toast">{toastMessage}</div>}
        <div className="sidepanel__body">
          <div className="sidepanel__content-scroll">{renderAuthenticatedContent()}</div>
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

  return renderContent()
}
export default SidePanel
