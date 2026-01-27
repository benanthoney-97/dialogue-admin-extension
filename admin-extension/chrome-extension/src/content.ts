import type { PlasmoCSConfig } from "plasmo"
import { initVisitorPlayer } from "./visitor-player"
import type { VisitorPlayer, RectLike } from "./visitor-player"

type PreviewPlayerRect = RectLike | DOMRect
type PreviewPlayerMetadata = Record<string, unknown>

export const config: PlasmoCSConfig = {
  matches: ["https://*/*"],
}

type MatchPayload = Record<string, unknown>

console.log("[content] script executing on", window.location.href)

const MATCH_MAP_SCRIPT_ID = "sl-match-map-data"
let cachedMatchMap: MatchPayload[] | null = null
let activeVisitorPlayer: VisitorPlayer | null = null
let lastNewMatchRect: RectLike | null = null
let lastPreviewMetadata: PreviewPlayerMetadata | null = null

const ensureVisitorPlayer = () => {
  if (activeVisitorPlayer) {
    return activeVisitorPlayer
  }
  activeVisitorPlayer = initVisitorPlayer()
  if (!activeVisitorPlayer) {
    console.warn("[content] visitor player initialization failed")
    return null
  }
  return activeVisitorPlayer
}

const DEFAULT_PREVIEW_RECT = () => ({
  left: Math.max(12, window.innerWidth - 340),
  bottom: 72,
  width: 0,
  height: 0,
})

const previewLibraryVideo = (
  __url?: string,
  rect?: PreviewPlayerRect | null,
  width?: number,
  ratio?: number,
  metadata?: PreviewPlayerMetadata | null
) => {
  const url = __url || ""
  if (!url) return
  console.log("[content] previewLibraryVideo invoked", { url, rect, width, ratio, metadata })
  const player = ensureVisitorPlayer()
  if (!player) return
  console.log("[content] visitor player ready, showing preview")
  const resolvedRect = rect ?? lastNewMatchRect ?? DEFAULT_PREVIEW_RECT()
  lastPreviewMetadata = metadata ?? null
  player.show({
    rect: resolvedRect instanceof DOMRect
      ? resolvedRect
      : new DOMRect(
          resolvedRect.left ?? DEFAULT_PREVIEW_RECT().left,
          resolvedRect.bottom ?? DEFAULT_PREVIEW_RECT().bottom,
          resolvedRect.width ?? DEFAULT_PREVIEW_RECT().width,
          resolvedRect.height ?? DEFAULT_PREVIEW_RECT().height
        ),
    width: width ?? 320,
    ratio: ratio ?? 16 / 9,
    url,
    metadata: lastPreviewMetadata ?? undefined,
  })
  console.log("[content] visitor player show invoked")
}

const parseMatchMapFromScript = () => {
  const script = document.getElementById(MATCH_MAP_SCRIPT_ID)
  if (!script || !script.textContent) {
    return []
  }

  try {
    const parsed = JSON.parse(script.textContent)
    if (Array.isArray(parsed)) {
      cachedMatchMap = parsed
      return parsed
    }
  } catch (error) {
    console.error("[content] failed to parse match map", error)
  }

  return []
}

const getMatchMap = () => {
  if (cachedMatchMap) {
    return cachedMatchMap
  }

  const windowMatchMap = (window as any).__SL_MATCH_MAP__
  if (Array.isArray(windowMatchMap)) {
    cachedMatchMap = windowMatchMap
    return windowMatchMap
  }

  return parseMatchMapFromScript()
}

const sendMatchClick = (matchIndex: number) => {
  console.log("[content] preparing match click", matchIndex)
  const match = getMatchMap()[matchIndex]
  if (!match) {
    console.warn("[content] no match found at index", matchIndex)
    return
  }

  const targetIsVisitor = document.documentElement?.classList.contains("sl-visitor-mode") ||
    document.body?.classList.contains("sl-visitor-mode")
  if (targetIsVisitor) {
    console.log("[content] page is in visitor mode, not sending matchClicked")
    return
  }

  const payload: MatchPayload = {
    ...match,
    page_match_id: match.page_match_id ?? match.id ?? null
  }
  console.log("[content] sending matchClicked to extension", match)
  chrome.runtime.sendMessage({ action: "matchClicked", match }, (response) => {
    const err = chrome.runtime.lastError
    if (err) {
      console.error("[content] sendMessage error", err)
    } else {
      console.log("[content] message acknowledged", response)
    }
  })
}

let newMatchSelectionActive = false
const handleNewMatchSelection = () => {
  const selection = window.getSelection()
  const text = selection?.toString().trim()
  if (!text) return
  if (selection?.rangeCount) {
    const rect = selection.getRangeAt(0).getBoundingClientRect()
    lastNewMatchRect = {
      left: rect.left,
      bottom: rect.bottom,
      width: rect.width,
      height: rect.height,
    }
  }
  chrome.runtime.sendMessage({ action: "newMatchSelection", text })
  disableNewMatchSelection()
}

const enableNewMatchSelection = () => {
  if (newMatchSelectionActive) return
  document.addEventListener("mouseup", handleNewMatchSelection)
  newMatchSelectionActive = true
}

const disableNewMatchSelection = () => {
  if (!newMatchSelectionActive) return
  document.removeEventListener("mouseup", handleNewMatchSelection)
  newMatchSelectionActive = false
}

document.addEventListener("click", (event) => {
  const target = (event.target as HTMLElement).closest(".sl-smart-link")
  if (!target) return
  event.preventDefault()
  console.log("[content] clicked smart-link", {
    text: target.textContent,
    idx: target.getAttribute("data-match-index"),
    pageMatchId: target.getAttribute("data-page-match-id"),
    classList: Array.from(target.classList)
  })
  const index = Number(target.getAttribute("data-match-index"))
  if (!Number.isNaN(index)) {
    console.log("[content] matched index", index)
    sendMatchClick(index)
  }
})

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === "enterNewMatchMode") {
    enableNewMatchSelection()
    return false
  }
  if (request.action === "exitNewMatchMode") {
    disableNewMatchSelection()
    return false
  }
  if (request.action === "removeMatchHighlight") {
    const id = request.page_match_id ?? request.match?.page_match_id ?? request.match?.id
    console.log("[content] removeMatchHighlight received", id)
    invokePageScriptRemoval(id)
    return false
  }
  if (request.action === "previewLibraryVideo") {
    lastPreviewMetadata = request.metadata ?? null
    console.log("[content] previewLibraryVideo message received", request.videoUrl, { tabId: request.tabId, metadata: request.metadata })
    previewLibraryVideo(request.videoUrl, undefined, undefined, undefined, request.metadata)
    return false
  }

  if (request.action === "read_page") {
    const content = document.body.innerText || ""
    
    // 1. Send response immediately
    sendResponse({
      title: document.title,
      url: window.location.href,
      content: content.replace(/\s+/g, " ").trim()
    })
    
    // 2. Do NOT return true here, because we just finished responding.
    return false 
  }
  
  // 3. If it's a message we don't recognize, return false to close the channel immediately.
  return false 
})

const handleCreateMatchEvent = (event: Event) => {
  const detail = (event as CustomEvent).detail
  console.log("[content] preview create match event", detail)
  chrome.runtime.sendMessage({ action: "previewCreateMatch", payload: detail })
}
window.addEventListener("dialogueCreateMatch", handleCreateMatchEvent)

const invokePageScriptRemoval = (matchId: number | string | undefined | null) => {
  if (!matchId) return
  const removeFn = (window as any).__SL_removeMatchHighlight
  if (typeof removeFn === "function") {
    removeFn(matchId)
  }
}
