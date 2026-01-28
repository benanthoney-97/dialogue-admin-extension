export {}

import {
  THRESHOLD_DEFAULT,
  THRESHOLD_VALUE_MAP,
  clampThresholdValue,
  determineThresholdLevel,
} from "./utils/threshold"
import type { ThresholdLevel } from "./utils/threshold"


chrome.sidePanel
  .setPanelBehavior({ openPanelOnActionClick: true })
  .then(() => console.log("BACKGROUND: Panel behavior set."))
  .catch((e) => console.error(e))

type MatchPayload = Record<string, unknown>
let latestMatch: MatchPayload | null = null
let lastMatchTabId: number | null = null
let pendingScrollMatchId: number | null = null
let globalThresholdLevel: ThresholdLevel = determineThresholdLevel(THRESHOLD_DEFAULT)
let globalThresholdValue = THRESHOLD_DEFAULT
let newMatchModeActive = false
const NEW_MATCH_SELECTION_KEY = "selectedNewMatchText"
let latestNewMatchSelection: string | null = null

const persistNewMatchSelection = (text: string | null) => {
  latestNewMatchSelection = text
  if (!chrome?.storage?.local) return
  if (text === null) {
    chrome.storage.local.remove(NEW_MATCH_SELECTION_KEY)
    return
  }
  chrome.storage.local.set({ [NEW_MATCH_SELECTION_KEY]: text })
}

declare global {
  interface Window {
    __SL_API_ORIGIN?: string
  }
}

const getApiOrigin = () => {
  // 1. (Optional) Keep window check if this code is shared with frontend, 
  // but it usually fails in background scripts anyway.
  if (typeof window !== "undefined" && (window as any).__SL_API_ORIGIN) {
    return (window as any).__SL_API_ORIGIN.replace(/\/$/, "")
  }

  // 2. THIS IS THE FIX: Use your new Plasmo variable
  if (process.env.PLASMO_PUBLIC_BACKEND_URL) {
    return process.env.PLASMO_PUBLIC_BACKEND_URL.replace(/\/$/, "")
  }

  // 3. Fallback only if everything explodes (you can likely remove this now)
  return "https://app.dialogue-ai.co" 
}

const API_ORIGIN = getApiOrigin()
const PAGE_MATCH_API = `${API_ORIGIN}/api/page-match`
const PROVIDER_DOCUMENT_API = `${API_ORIGIN}/api/provider-document`
const PROVIDER_KNOWLEDGE_API = `${API_ORIGIN}/api/provider-knowledge`
const SITE_SETTINGS_API = `${API_ORIGIN}/api/provider-site-settings`

let currentProviderId: number | null = null

const safeProviderId = () => {
  if (!currentProviderId) {
    return 12
  }
  return currentProviderId
}

chrome.storage?.local?.get?.({ providerId: null }, (result) => {
  const stored = toNumber(result?.providerId)
  if (stored) {
    currentProviderId = stored
    fetchSiteSettings(stored)
    registerDynamicContentScriptForProvider(stored)
  }
})

chrome.storage?.local?.get?.({ [NEW_MATCH_SELECTION_KEY]: null }, (result) => {
  latestNewMatchSelection = result?.[NEW_MATCH_SELECTION_KEY] ?? null
})

chrome.storage?.onChanged?.addListener((changes, area) => {
  if (area === "local" && changes.providerId) {
    currentProviderId = toNumber(changes.providerId.newValue) ?? null
    fetchSiteSettings(safeProviderId())
    registerDynamicContentScriptForProvider(currentProviderId)
  }
})

const sendMessageToActiveTab = (message: Record<string, unknown>) => {
  const targetTabId = lastMatchTabId
  const deliver = (tabId: number) => {
    console.log("[sl-background] sending message to tab", { tabId, message })
    chrome.tabs.sendMessage(tabId, message, () => {
      if (chrome.runtime.lastError) {
        console.warn("[sl-background] sendMessage failed", chrome.runtime.lastError)
      } else {
        console.log("[sl-background] sendMessage succeeded")
      }
    })
  }

  if (typeof targetTabId === "number") {
    deliver(targetTabId)
    return
  }

  chrome.tabs.query({ active: true, lastFocusedWindow: true }, (tabs) => {
    const active = tabs?.[0]
    if (!active?.id) return
    deliver(active.id)
  })
}

const toNumber = (value: unknown) => {
  if (typeof value === 'number' && !Number.isNaN(value)) {
    return value
  }
  if (typeof value === 'string' && value.trim() !== '') {
    const parsed = Number(value)
    return Number.isNaN(parsed) ? undefined : parsed
  }
  return undefined
}

const resolvePageMatchId = (match: MatchPayload) =>
  toNumber(
    match.page_match_id ??
      match.pageMatchId ??
      match.pageMatchID ??
      match.pageMatchid ??
      match.pageMatch ??
      match.id
  )

const toString = (value: unknown) => (typeof value === 'string' ? value : '')

const toVimeoPlayerUrl = (value: unknown) => {
  if (typeof value !== 'string') return value

  const matches = [
    /vimeo\.com\/(\d+)/,
    /player\.vimeo\.com\/video\/(\d+)/
  ]
  let videoId: string | null = null

  for (const pattern of matches) {
    const found = value.match(pattern)
    if (found) {
      videoId = found[1]
      break
    }
  }

  if (!videoId) return value

  const timestampMatch = value.match(/#t=(\d+)/)
  const suffix = timestampMatch ? `#t=${timestampMatch[1]}s` : ''
  return `https://player.vimeo.com/video/${videoId}?autoplay=1&muted=0&title=0&byline=0${suffix}`
}

const logMatchClickEvent = async (match: MatchPayload) => {
  const pageMatchId = resolvePageMatchId(match)
  if (!pageMatchId) return
  const pageUrl = toString(match.page_url ?? match.url ?? "")
  const knowledgeId = toNumber(match.knowledge_id ?? match.knowledgeId ?? null)
  const payload = {
    provider_id: safeProviderId(),
    page_match_id: pageMatchId,
    page_url: pageUrl || undefined,
    knowledge_id: knowledgeId || undefined,
  }
  try {
    await fetch(`${API_ORIGIN}/api/match-clicked`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    })
  } catch (error) {
  }
}

const notifyThresholdData = (value: number, level: ThresholdLevel) => {
  chrome.runtime.sendMessage(
    { action: "thresholdData", thresholdValue: value, thresholdLevel: level },
    () => {
      if (chrome.runtime.lastError) {
      }
    }
  )
}

const updateGlobalThreshold = (value: number) => {
  const clamped = clampThresholdValue(value)
  const level = determineThresholdLevel(clamped)
  globalThresholdLevel = level
  globalThresholdValue = clamped
  notifyThresholdData(clamped, level)
  propagateThresholdToTab()
  propagatePageReload()
}

const fetchSiteSettings = async (providerId: number) => {
  const url = `${SITE_SETTINGS_API}?provider_id=${encodeURIComponent(providerId)}`
  try {
    const data = await fetchJson(url)
    if (typeof data?.match_threshold === "number") {
      updateGlobalThreshold(data.match_threshold)
    }
  } catch (error) {
  }
}

const persistSiteThreshold = async (providerId: number, value: number) => {
  const url = `${SITE_SETTINGS_API}?provider_id=${encodeURIComponent(providerId)}`
  const clamped = clampThresholdValue(value)
  try {
    const response = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        match_threshold: clamped,
      }),
    })
    if (!response.ok) {
      const text = await response.text()
      throw new Error(`Failed to persist threshold (${response.status}): ${text}`)
    }

    await fetchSiteSettings(providerId)
  } catch (error) {
  }
}

const fetchJson = async (url: string) => {
  const response = await fetch(url)
  if (!response.ok) {
    throw new Error(`Fetch failed (${response.status}) for ${url}`)
  }
  return response.json()
}

const dynamicContentScriptId = "sl-dynamic-content-script"
let lastRegisteredMatchesKey = ""

const getContentScriptDefinition = () => {
  const manifest = chrome.runtime.getManifest()
  return manifest.content_scripts?.[0] ?? null
}

const buildTrackMatches = (pageUrls: string[]) => {
  const origins = new Set<string>()
  for (const pageUrl of pageUrls) {
    try {
      const parsed = new URL(pageUrl)
      origins.add(`${parsed.origin}/*`)
    } catch {
      continue
    }
  }
  return Array.from(origins)
}

const fetchTrackedPageOrigins = async (providerId: number) => {
  const feedEndpoint = `${API_ORIGIN}/api/sitemap-feeds?provider_id=${encodeURIComponent(providerId)}`
  const feeds = await fetchJson(feedEndpoint)
  if (!Array.isArray(feeds) || feeds.length === 0) {
    return []
  }
  const trackedPages: string[] = []
  for (const feed of feeds) {
    const feedId = feed?.id
    if (!feedId) continue
    try {
      const pageEndpoint = `${API_ORIGIN}/api/sitemap-pages?feed_id=${encodeURIComponent(feedId)}`
      const pages = await fetchJson(pageEndpoint)
      if (!Array.isArray(pages)) continue
      for (const page of pages) {
        if (page?.tracked && page.page_url) {
          trackedPages.push(page.page_url)
        }
      }
    } catch (error) {
    }
  }
  return trackedPages
}

const unregisterDynamicContentScript = async () => {
  try {
    await chrome.scripting.unregisterContentScripts({ ids: [dynamicContentScriptId] })
  } catch (error) {
  }
  lastRegisteredMatchesKey = ""
}

const registerDynamicContentScriptForProvider = async (providerId: number | null) => {
  if (!chrome.scripting?.registerContentScripts || !chrome.scripting.unregisterContentScripts) {
    return
  }
  if (!providerId) {
    await unregisterDynamicContentScript()
    return
  }
  const manifestEntry = getContentScriptDefinition()
  if (!manifestEntry || !manifestEntry.js?.length) {
    return
  }
  try {
    const trackedUrls = await fetchTrackedPageOrigins(providerId)
    const matches = buildTrackMatches(trackedUrls)
    const cacheKey = matches.join("|")
    if (!matches.length) {
      await unregisterDynamicContentScript()
      return
    }
    if (cacheKey === lastRegisteredMatchesKey) {
      return
    }
    await unregisterDynamicContentScript()
    await chrome.scripting.registerContentScripts([
      {
        id: dynamicContentScriptId,
        matches,
        js: manifestEntry.js,
        css: manifestEntry.css ?? [],
        runAt: (manifestEntry as any).run_at || "document_idle",
        world: (manifestEntry as any).world ?? "ISOLATED",
      },
    ])
    lastRegisteredMatchesKey = cacheKey
  } catch (error) {
  }
}

const fetchPageMatch = async (pageMatchId: number | undefined | null) => {
  if (!pageMatchId) return null
  const url = `${PAGE_MATCH_API}?page_match_id=${encodeURIComponent(pageMatchId)}`
  try {
    return await fetchJson(url)
  } catch (error) {
    return null
  }
}

const fetchProviderDocument = async (documentId: number | undefined | null, providerId: number | undefined | null) => {
  if (!documentId || !providerId) return null
  const url = `${PROVIDER_DOCUMENT_API}?document_id=${encodeURIComponent(documentId)}&provider_id=${encodeURIComponent(providerId)}`
  try {
    return await fetchJson(url)
  } catch (error) {
    return null
  }
}

const fetchProviderKnowledge = async (knowledgeId: number | undefined | null) => {
  if (!knowledgeId) return null
  const url = `${PROVIDER_KNOWLEDGE_API}?knowledge_id=${encodeURIComponent(knowledgeId)}`
  try {
    return await fetchJson(url)
  } catch (error) {
    return null
  }
}

const mergeDecisionPayload = (
  match: MatchPayload,
  pageMatch: Record<string, unknown> | null,
  doc: Record<string, unknown> | null,
  knowledge: Record<string, unknown> | null
) => {
  const merged = {
    ...match,
    ...(pageMatch || {})
  }

  if (doc) {
    const docTitle = toString(doc.title)
    const coverImage = toString(doc.cover_image_url)
    const sourceUrl = toString(doc.source_url)
    merged.document_title = docTitle || merged.document_title
    merged.title = docTitle || merged.title || ''
    merged.cover_image_url = coverImage || merged.cover_image_url || ''
    merged.is_active = typeof merged.is_active === 'undefined' ? doc.is_active : merged.is_active
    merged.source_url = sourceUrl || merged.source_url || ''
    merged.document_id = toNumber(doc.id) ?? merged.document_id
  }

  if (knowledge) {
    merged.content = toString(knowledge.content) || merged.content
    merged.knowledge_metadata = knowledge.metadata || merged.knowledge_metadata
  }

  return merged
}

const fetchDecisionData = async (match: MatchPayload) => {
  const pageMatchId = resolvePageMatchId(match)
  let pageMatch = await fetchPageMatch(pageMatchId)
  if (pageMatch && pageMatch.video_url) {
    pageMatch = {
      ...pageMatch,
      video_url: toVimeoPlayerUrl(pageMatch.video_url)
    }
  }
  const documentId = pageMatch?.document_id ?? match.document_id
  const providerId = toNumber(match.provider_id)
  const doc = await fetchProviderDocument(toNumber(documentId), providerId)
  const knowledgeId = toNumber(pageMatch?.knowledge_id ?? match.knowledge_id)
  const knowledge = await fetchProviderKnowledge(knowledgeId)
  return mergeDecisionPayload(match, pageMatch, doc, knowledge)
}

const MODE_ADMIN = "admin"
const MODE_VISITOR = "visitor"

const notifyMatchData = (payload: MatchPayload) => {
  chrome.runtime.sendMessage({ action: "matchData", match: payload }, () => {
    if (chrome.runtime.lastError) {
    }
  })
}

fetchSiteSettings(safeProviderId())

const executePageHighlightRemoval = async (tabId: number, matchId: number) => {
  try {
    await chrome.scripting.executeScript({
      target: { tabId },
      world: "MAIN",
      func: (id: number) => {
        const remover = (window as any).__SL_removeMatchHighlight
        if (typeof remover === "function") {
          remover(id)
        }
      },
      args: [matchId]
    })
  } catch (error) {
  }
}

const executePageHighlightAddition = async (tabId: number, match: MatchPayload) => {
  try {
    await chrome.scripting.executeScript({
      target: { tabId },
      world: "MAIN",
      func: (matchData: MatchPayload) => {
        const adder = (window as any).__SL_addMatchHighlight
        if (typeof adder === "function") {
          adder(matchData)
        } else {
        }
      },
      args: [match]
    })
  } catch (error) {
  }
}

const executePageSetHover = async (tabId: number, matchId: number, hovered: boolean) => {
  try {
    await chrome.scripting.executeScript({
      target: { tabId },
      world: "MAIN",
      func: (id: number, isHovered: boolean) => {
        const targetId = String(id)
        const spans = document.querySelectorAll(`.sl-smart-link[data-page-match-id="${targetId}"]`)
        spans.forEach((span) => {
          if (isHovered) {
            span.classList.add("sl-smart-link--hover")
          } else {
            span.classList.remove("sl-smart-link--hover")
          }
        })
      },
      args: [matchId, hovered],
    })
  } catch (error) {
  }
}

const executePageMode = async (tabId: number, mode: string) => {
  try {
    await chrome.scripting.executeScript({
      target: { tabId },
      world: "MAIN",
      func: (modeValue: string) => {
        const setter = (window as any).__SL_setMode
        if (typeof setter === "function") {
          setter(modeValue)
        } else {
        }
      },
      args: [mode]
    })
  } catch (error) {
  }
}

async function executeThresholdUpdate(tabId: number, value: number) {
  console.log("[sl-background] executeThresholdUpdate", { tabId, value })
  try {
    await chrome.scripting.executeScript({
      target: { tabId },
      world: "MAIN",
      func: (thresholdValue: number) => {
        const applier = (window as any).__SL_applyThreshold
        if (typeof applier === "function") {
          applier(thresholdValue)
        }
      },
      args: [value],
    })
  } catch (error) {
  }
}

const reloadTab = (tabId: number) => {
  try {
    chrome.tabs.reload(tabId)
  } catch (error) {
  }
}

function propagateThresholdToTab(preferredTabId?: number) {
  const tabId = preferredTabId ?? lastMatchTabId
  if (tabId) {
    executeThresholdUpdate(tabId, globalThresholdValue)
    return
  }
  chrome.tabs.query({ active: true, lastFocusedWindow: true }, (tabs) => {
    const active = tabs?.[0]
    const activeId = active?.id
    if (activeId) {
      lastMatchTabId = activeId
      executeThresholdUpdate(activeId, globalThresholdValue)
    }
  })
}

function propagatePageReload(preferredTabId?: number) {
  const tabId = preferredTabId ?? lastMatchTabId
  if (tabId) {
    reloadTab(tabId)
    return
  }
  chrome.tabs.query({ active: true, lastFocusedWindow: true }, (tabs) => {
    const active = tabs?.[0]
    const activeId = active?.id
    if (activeId) {
      lastMatchTabId = activeId
      reloadTab(activeId)
    }
  })
}

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.action === "deliverNewMatchSelection") {
    return false
  }
  if (message.action === "newMatchSelection") {
    if (message.text) {
      persistNewMatchSelection(message.text)
      if (newMatchModeActive) {
        chrome.runtime.sendMessage({ action: "deliverNewMatchSelection", text: message.text })
      }
    }
    return false
  }
  if (message.action === "enterNewMatchMode") {
    newMatchModeActive = true
    sendMessageToActiveTab({ action: "enterNewMatchMode" })
    return false
  }
  if (message.action === "exitNewMatchMode") {
    newMatchModeActive = false
    sendMessageToActiveTab({ action: "exitNewMatchMode" })
    return false
  }
  if (message.action === "setThreshold") {

    let requestedValue = toNumber(message.thresholdValue ?? message.threshold)
    if (typeof requestedValue !== "number" && typeof message.threshold === "string") {
      const level = message.threshold
      if (level && THRESHOLD_VALUE_MAP[level as ThresholdLevel] !== undefined) {
        requestedValue = THRESHOLD_VALUE_MAP[level as ThresholdLevel]
      }
    }
    if (typeof requestedValue === "number") {
      updateGlobalThreshold(requestedValue)
      persistSiteThreshold(safeProviderId(), requestedValue)
    } else {
    }
    return false
  }
  if (message.action === "matchClicked") {
    void logMatchClickEvent(message.match)
    lastMatchTabId = sender.tab?.id ?? lastMatchTabId
    const tabId = sender.tab?.id
    const windowId = sender.tab?.windowId
    const openOptions: chrome.sidePanel.OpenOptions = tabId
      ? { tabId }
      : windowId
      ? { windowId }
      : { windowId: chrome.windows.WINDOW_ID_CURRENT }
    chrome.sidePanel.open(openOptions, () => {})
    fetchDecisionData(message.match).then((data) => {
      latestMatch = data
      notifyMatchData(data)
    })
    return false
  }

  if (message.action === "removeMatchHighlight") {
    const matchId = toNumber(message.page_match_id ?? message.match?.page_match_id ?? message.match?.id)
    const targetTabId = lastMatchTabId ?? sender.tab?.id
    if (matchId && targetTabId) {
      executePageHighlightRemoval(targetTabId, matchId)
    } else if (matchId) {
      chrome.tabs.query({ active: true, lastFocusedWindow: true }, (tabs) => {
        const fallback = tabs?.[0]
        const fallbackId = fallback?.id
        if (fallbackId) {
          lastMatchTabId = fallbackId
          executePageHighlightRemoval(fallbackId, matchId)
        }
      })
    }
    return false
  }

  if (message.action === "restoreMatchHighlight") {
    const matchData = message.match
    if (!matchData) {
      return false
    }
    const targetTabId = lastMatchTabId ?? sender.tab?.id
    if (targetTabId) {
      executePageHighlightAddition(targetTabId, matchData)
    } else {
      chrome.tabs.query({ active: true, lastFocusedWindow: true }, (tabs) => {
        const fallback = tabs?.[0]
        const fallbackId = fallback?.id
        if (fallbackId) {
          lastMatchTabId = fallbackId
          executePageHighlightAddition(fallbackId, matchData)
        }
      })
    }
    return false
  }

  if (message.action === "previewLibraryVideo") {
    console.log("[sl-background] previewLibraryVideo relaying", { message, lastMatchTabId })
    sendMessageToActiveTab(message)
    return false
  }

  if (message.action === "navigateToMatch") {
    const url = message.url
    const targetTabId = lastMatchTabId ?? sender.tab?.id
    console.log("[sl-background] navigateToMatch request", { url, matchId: message.matchId, targetTabId })
    if (url && targetTabId) {
      chrome.tabs.update(targetTabId, { url }, () => {
        pendingScrollMatchId = message.matchId ?? null
        notifyTabOfScroll(targetTabId)
      })
      lastMatchTabId = targetTabId
    }
    return false
  }

  if (message.action === "setMatchHover") {
    const matchId = toNumber(message.page_match_id ?? message.match?.page_match_id ?? message.match?.id)
    const hovered = Boolean(message.hovered)
    const targetTabId = lastMatchTabId ?? sender.tab?.id
    if (matchId && targetTabId) {
      executePageSetHover(targetTabId, matchId, hovered)
    }
    return false
  }

  if (message.action === "setPageMode") {
    const mode = message.mode === MODE_ADMIN ? MODE_ADMIN : MODE_VISITOR
    const targetTabId = lastMatchTabId ?? sender.tab?.id
    if (targetTabId) {
      executePageMode(targetTabId, mode)
    } else {
      chrome.tabs.query({ active: true, lastFocusedWindow: true }, (tabs) => {
        const fallback = tabs?.[0]
        const fallbackId = fallback?.id
        if (fallbackId) {
          lastMatchTabId = fallbackId
          executePageMode(fallbackId, mode)
        }
      })
    }
    return false
  }

  if (message.action === "refreshMatch") {
    const payloadMatch = message.match
    if (!payloadMatch) {
      return false
    }
    fetchDecisionData(payloadMatch)
      .then((data) => {
        latestMatch = data
        notifyMatchData(data)
      })
      .catch((error) => {
      })
    return false
  }

  if (message.action === "getLatestMatch") {
    sendResponse({ match: latestMatch })
    return true
  }

  return false
})

const getActiveTabId = () =>
  new Promise<number | null>((resolve) => {
    chrome.tabs?.query({ active: true, lastFocusedWindow: true }, (tabs) => {
      const active = tabs?.[0]
      resolve(active?.id ?? null)
    })
  })

chrome.runtime.onConnect.addListener((port) => {
  if (port.name !== "admin-mode") return
  getActiveTabId().then((tabId) => {
    if (tabId) {
      lastMatchTabId = tabId
      executePageMode(tabId, MODE_ADMIN)
    }
  })
  port.onDisconnect.addListener(() => {
    getActiveTabId().then((tabId) => {
      if (tabId) {
        lastMatchTabId = tabId
        executePageMode(tabId, MODE_VISITOR)
      }
    })
  })
})
const notifyTabOfScroll = (tabId: number) => {
  if (!pendingScrollMatchId) return
  chrome.tabs.sendMessage(
    tabId,
    { action: "scrollToMatch", matchId: pendingScrollMatchId },
    () => {
      if (!chrome.runtime.lastError) {
        console.log("[sl-background] scrollToMatch acknowledged", { tabId, matchId: pendingScrollMatchId })
        pendingScrollMatchId = null
      }
    }
  )
}

chrome.tabs?.onUpdated?.addListener((tabId, changeInfo) => {
  if (tabId !== lastMatchTabId) return
  if (changeInfo.status === "complete" && pendingScrollMatchId) {
    notifyTabOfScroll(tabId)
  }
})
