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
import { NewMatchPrompt } from "./components/new-match-prompt"
import { ConfirmAction } from "./components/confirm-action"
import { LoginForm } from "./components/login-form/login-form"
import { LibraryDocumentsGrid } from "./components/library-documents-grid"
import type { LibraryDocument } from "./components/library-documents-grid"
import { SingleViewVideo } from "./components/single-view-video"
import type { SitemapFeed } from "./components/sitemap-feeds-table"
import { LibraryProvidersGrid, type LibraryProvider } from "./components/library-providers-grid"
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
}

type DecisionContext = "page" | "video"

type NavSection = "page" | "sitemap" | "new-match" | "library"

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
      return
    }
    let canceled = false
    const fetchName = async () => {
      try {
        const { data, error } = await supabase
          .from("providers")
          .select("name")
          .eq("id", providerId)
          .single()
        if (canceled) return
        if (error) {
          throw error
        }
        setProviderName(data?.name ?? null)
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
    try {
      const response = await fetch(endpoint, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          document_id: manualSelectedDoc.id,
          provider_id: resolveProviderId(),
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
        const providerTabLabel = providerName ?? "Your library"
        const resolvedProviderId = resolveProviderId()
        return (
          <div className="new-match-documents">
            <div className="new-match-documents__header">Selected text</div>
            {selectedNewMatchText && (
              <div className="new-match-documents__phrase">{selectedNewMatchText}</div>
            )}
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
                        >
                          ← Providers
                        </button>
                        <div>
                          <div className="library-documents-title">
                            {manualLibraryProviderName ?? "Provider library"}
                          </div>
                          <div className="library-documents-subtitle">Library</div>
                        </div>
                      </div>
                      <LibraryDocumentsGrid
                        providerId={manualLibraryProviderId}
                        onDocumentSelect={handleManualDocumentSelect}
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
                  chrome.runtime.sendMessage({ action: "exitNewMatchMode" })
                }}
              >
                <span aria-hidden="true" className="new-match-prompt__star-icon">
                  <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" className="bi bi-stars" viewBox="0 0 16 16">
                    <path d="M7.657 6.247c.11-.33.576-.33.686 0l.645 1.937a2.89 2.89 0 0 0 1.829 1.828l1.936.645c.33.11.33.576 0 .686l-1.937.645a2.89 2.89 0 0 0-1.828 1.829l-.645 1.936a.361.361 0 0 1-.686 0l-.645-1.937a2.89 2.89 0 0 0-1.828-1.828l-1.937-.645a.361.361 0 0 1 0-.686l1.937-.645a2.89 2.89 0 0 0 1.828-1.828zM3.794 1.148a.217.217 0 0 1 .412 0l.387 1.162c.173.518.579.924 1.097 1.097l1.162.387a.217.217 0 0 1 0 .412l-1.162.387A1.73 1.73 0 0 0 4.593 5.69l-.387 1.162a.217.217 0 0 1-.412 0L3.407 5.69A1.73 1.73 0 0 0 2.31 4.593l-1.162-.387a.217.217 0 0 1 0-.412l1.162-.387A1.73 1.73 0 0 0 3.407 2.31zM10.863.099a.145.145 0 0 1 .274 0l.258.774c.115.346.386.617.732.732l.774.258a.145.145 0 0 1 0 .274l-.774.258a1.16 1.16 0 0 0-.732.732l-.258.774a.145.145 0 0 1-.274 0l-.258-.774a1.16 1.16 0 0 0-.732-.732L9.1 2.137a.145.145 0 0 1 0-.274l.774-.258c.346-.115.617-.386.732-.732z"/>
                  </svg>
                </span>
                Best matches
              </button>
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
          onReset={handleStartOver}
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
                <div className="page-new-match-overlay">{renderNewMatchFlow()}</div>
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
        const providerTabLabel = providerName ?? "Your library"
        if (selectedLibraryProviderId) {
          return (
            <div className="library-main-shell">
              <div className="library-documents-shell">
                <div className="library-documents-header">
                  <button
                    type="button"
                    className="library-documents-back"
                    onClick={handleLibraryProvidersBack}
                  >
                    ← Providers
                  </button>
                  <div>
                    <div className="library-documents-title">
                      {selectedLibraryProviderName ?? "Provider library"}
                    </div>
                    <div className="library-documents-subtitle">Library</div>
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
            if (selection === "new-match") {
              enterNewMatchMode()
            }
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
