export {}

console.log("BACKGROUND: Service Worker Loaded!")

chrome.sidePanel
  .setPanelBehavior({ openPanelOnActionClick: true })
  .then(() => console.log("BACKGROUND: Panel behavior set."))
  .catch((e) => console.error(e))

type MatchPayload = Record<string, unknown>
let latestMatch: MatchPayload | null = null
let lastMatchTabId: number | null = null
let globalThresholdLevel: "high" | "medium" | "low" = "medium"
let globalThresholdValue = 0.6
let newMatchModeActive = false

declare global {
  interface Window {
    __SL_API_ORIGIN?: string
  }
}

const getApiOrigin = () => {
  if (typeof window !== "undefined" && window.__SL_API_ORIGIN) {
    return window.__SL_API_ORIGIN.replace(/\/$/, "")
  }
  if (typeof process !== "undefined" && process.env.API_ORIGIN) {
    return process.env.API_ORIGIN.replace(/\/$/, "")
  }
  if (typeof chrome !== "undefined" && chrome.runtime?.getURL) {
    const match = chrome.runtime.getURL("").match(/(https?:\/\/[^/]+)/)
    if (match) return match[1]
  }
  return "http://localhost:4173"
}

const API_ORIGIN = getApiOrigin()
const PAGE_MATCH_API = `${API_ORIGIN}/api/page-match`
const PROVIDER_DOCUMENT_API = `${API_ORIGIN}/api/provider-document`
const PROVIDER_KNOWLEDGE_API = `${API_ORIGIN}/api/provider-knowledge`
const SITE_SETTINGS_API = `${API_ORIGIN}/api/provider-site-settings`

let currentProviderId: number | null = null

const safeProviderId = () => {
  if (!currentProviderId) {
    console.warn("[background] provider id missing, defaulting to 12")
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

chrome.storage?.onChanged?.addListener((changes, area) => {
  if (area === "local" && changes.providerId) {
    currentProviderId = toNumber(changes.providerId.newValue) ?? null
    console.log("[background] updated provider id", currentProviderId)
    fetchSiteSettings(safeProviderId())
    registerDynamicContentScriptForProvider(currentProviderId)
  }
})

const sendMessageToActiveTab = (message: Record<string, unknown>) => {
  chrome.tabs.query({ active: true, lastFocusedWindow: true }, (tabs) => {
    const active = tabs?.[0]
    if (!active?.id) return
    chrome.tabs.sendMessage(active.id, message, () => {
      if (chrome.runtime.lastError) {
        console.warn("[background] sendMessageToActiveTab error", chrome.runtime.lastError.message)
      }
    })
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
  return `https://player.vimeo.com/video/${videoId}?autoplay=1&title=0&byline=0${suffix}`
}

const THRESHOLD_VALUES: Record<"high" | "medium" | "low", number> = {
  high: 0.75,
  medium: 0.6,
  low: 0.4,
}

const determineThresholdLevel = (value: number) => {
  if (value >= THRESHOLD_VALUES.high) return "high"
  if (value <= THRESHOLD_VALUES.low) return "low"
  return "medium"
}

const notifyThresholdData = (level: "high" | "medium" | "low") => {
  chrome.runtime.sendMessage({ action: "thresholdData", threshold: level }, () => {
    if (chrome.runtime.lastError) {
      console.warn("[background] notify threshold error", chrome.runtime.lastError.message)
    }
  })
}

const updateGlobalThreshold = (level: "high" | "medium" | "low") => {
  globalThresholdLevel = level
  globalThresholdValue = THRESHOLD_VALUES[level]
  console.log("[background] global threshold set", globalThresholdLevel, globalThresholdValue)
  notifyThresholdData(level)
  propagateThresholdToTab()
}

const fetchSiteSettings = async (providerId: number) => {
  const url = `${SITE_SETTINGS_API}?provider_id=${encodeURIComponent(providerId)}`
  try {
    const data = await fetchJson(url)
    if (typeof data?.match_threshold === "number") {
      updateGlobalThreshold(determineThresholdLevel(data.match_threshold))
    }
  } catch (error) {
    console.error("[background] fetch site settings error", error)
  }
}

const persistSiteThreshold = async (providerId: number, level: "high" | "medium" | "low") => {
  const url = `${SITE_SETTINGS_API}?provider_id=${encodeURIComponent(providerId)}`
  try {
    const response = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        match_threshold: THRESHOLD_VALUES[level],
      }),
    })
      if (!response.ok) {
        const text = await response.text()
        throw new Error(`Failed to persist threshold (${response.status}): ${text}`)
      }

      await fetchSiteSettings(providerId)
  } catch (error) {
    console.error("[background] persist threshold error", error)
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
      console.error("[background] fetch tracked pages error", { feedId, error })
    }
  }
  return trackedPages
}

const unregisterDynamicContentScript = async () => {
  try {
    await chrome.scripting.unregisterContentScripts({ ids: [dynamicContentScriptId] })
  } catch (error) {
    console.warn("[background] unregister content script error", error)
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
    console.warn("[background] content script definition missing")
    return
  }
  try {
    const trackedUrls = await fetchTrackedPageOrigins(providerId)
    const matches = buildTrackMatches(trackedUrls)
    const cacheKey = matches.join("|")
    if (!matches.length) {
      await unregisterDynamicContentScript()
      console.log("[background] no tracked matches, skipping content script registration")
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
    console.log("[background] registered content script for matches", matches)
  } catch (error) {
    console.error("[background] register content script error", error)
  }
}

const fetchPageMatch = async (pageMatchId: number | undefined | null) => {
  if (!pageMatchId) return null
  const url = `${PAGE_MATCH_API}?page_match_id=${encodeURIComponent(pageMatchId)}`
  try {
    console.log("[background] fetching page match", url)
    return await fetchJson(url)
  } catch (error) {
    console.error("[background] page match fetch error", error)
    return null
  }
}

const fetchProviderDocument = async (documentId: number | undefined | null, providerId: number | undefined | null) => {
  if (!documentId || !providerId) return null
  const url = `${PROVIDER_DOCUMENT_API}?document_id=${encodeURIComponent(documentId)}&provider_id=${encodeURIComponent(providerId)}`
  try {
    console.log("[background] fetching provider document", url)
    return await fetchJson(url)
  } catch (error) {
    console.error("[background] provider document fetch error", error)
    return null
  }
}

const fetchProviderKnowledge = async (knowledgeId: number | undefined | null) => {
  if (!knowledgeId) return null
  const url = `${PROVIDER_KNOWLEDGE_API}?knowledge_id=${encodeURIComponent(knowledgeId)}`
  try {
    console.log("[background] fetching provider knowledge", url)
    return await fetchJson(url)
  } catch (error) {
    console.error("[background] provider knowledge fetch error", error)
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
      console.warn("[background] notifyMatchData error", chrome.runtime.lastError.message)
    }
  })
}

fetchSiteSettings(safeProviderId())

const executePageHighlightRemoval = async (tabId: number, matchId: number) => {
  console.log("[background] executePageHighlightRemoval start", { tabId, matchId })
  try {
    await chrome.scripting.executeScript({
      target: { tabId },
      world: "MAIN",
      func: (id: number) => {
        console.log("[background] invoke helper from page", id, (window as any).__SL_removeMatchHighlight)
        const remover = (window as any).__SL_removeMatchHighlight
        if (typeof remover === "function") {
          remover(id)
        }
      },
      args: [matchId]
    })
    console.log("[background] executePageHighlightRemoval success", { tabId, matchId })
  } catch (error) {
    console.error("[background] scripting removal error", error)
  }
}

const executePageHighlightAddition = async (tabId: number, match: MatchPayload) => {
  console.log("[background] executePageHighlightAddition start", { tabId, match })
  try {
    await chrome.scripting.executeScript({
      target: { tabId },
      world: "MAIN",
      func: (matchData: MatchPayload) => {
        console.log("[background] invoke add helper from page", matchData?.page_match_id, matchData?.phrase, matchData)
        const adder = (window as any).__SL_addMatchHighlight
        if (typeof adder === "function") {
          adder(matchData)
        } else {
          console.warn("[background] add helper missing on page", matchData?.page_match_id)
        }
      },
      args: [match]
    })
    console.log("[background] executePageHighlightAddition success", { tabId, match })
  } catch (error) {
    console.error("[background] scripting addition error", error)
  }
}

const executePageSetHover = async (tabId: number, matchId: number, hovered: boolean) => {
  console.log("[background] executePageSetHover start", { tabId, matchId, hovered })
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
    console.log("[background] executePageSetHover success", { tabId, matchId, hovered })
  } catch (error) {
    console.error("[background] scripting hover error", error)
  }
}

const executePageMode = async (tabId: number, mode: string) => {
  console.log("[background] executePageMode start", { tabId, mode })
  try {
    await chrome.scripting.executeScript({
      target: { tabId },
      world: "MAIN",
      func: (modeValue: string) => {
        console.log("[background] invoke setMode from page", modeValue)
        const setter = (window as any).__SL_setMode
        if (typeof setter === "function") {
          setter(modeValue)
        } else {
          console.warn("[background] mode setter missing on page")
        }
      },
      args: [mode]
    })
    console.log("[background] executePageMode success", { tabId, mode })
  } catch (error) {
    console.error("[background] scripting mode error", error)
  }
}

async function executeThresholdUpdate(tabId: number, value: number) {
  console.log("[background] executeThresholdUpdate start", { tabId, value })
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
    console.log("[background] executeThresholdUpdate success", { tabId, value })
  } catch (error) {
    console.error("[background] scripting threshold error", error)
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

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  console.log("[background] received message", message)
  if (message.action === "deliverNewMatchSelection") {
    return false
  }
  if (message.action === "newMatchSelection") {
    if (newMatchModeActive && message.text) {
      chrome.runtime.sendMessage({ action: "deliverNewMatchSelection", text: message.text })
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
    const threshold = message.threshold
    if (threshold && ["high", "medium", "low"].includes(threshold)) {
      updateGlobalThreshold(threshold)
      persistSiteThreshold(safeProviderId(), threshold)
    }
    return false
  }
  if (message.action === "setThreshold") {
    const threshold = message.threshold
    if (threshold && ["high", "medium", "low"].includes(threshold)) {
      updateGlobalThreshold(threshold)
    }
    return false
  }
  if (message.action === "matchClicked") {
    console.log("[background] matchClicked", message.match)
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
    console.log("[background] removeMatchHighlight received", matchId, "lastTabId", lastMatchTabId)
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
    console.log("[background] restoreMatchHighlight received", matchData)
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

  if (message.action === "setMatchHover") {
    const matchId = toNumber(message.page_match_id ?? message.match?.page_match_id ?? message.match?.id)
    const hovered = Boolean(message.hovered)
    console.log("[background] setMatchHover received", { matchId, hovered })
    const targetTabId = lastMatchTabId ?? sender.tab?.id
    if (matchId && targetTabId) {
      executePageSetHover(targetTabId, matchId, hovered)
    }
    return false
  }

  if (message.action === "setPageMode") {
    const mode = message.mode === MODE_ADMIN ? MODE_ADMIN : MODE_VISITOR
    console.log("[background] setPageMode received", mode)
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
        console.error("[background] refreshMatch error", error)
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
    console.log("[background] admin port connected", { tabId })
    if (tabId) {
      lastMatchTabId = tabId
      executePageMode(tabId, MODE_ADMIN)
    }
  })
  port.onDisconnect.addListener(() => {
    getActiveTabId().then((tabId) => {
      console.log("[background] admin port disconnected", { tabId })
      if (tabId) {
        lastMatchTabId = tabId
        executePageMode(tabId, MODE_VISITOR)
      }
    })
  })
})
