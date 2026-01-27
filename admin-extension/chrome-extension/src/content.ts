import type { PlasmoCSConfig } from "plasmo"

type PreviewPlayerRect = {
  left: number
  bottom: number
  width: number
  height: number
}

type DialoguePlayerModule = {
  initVisitorPlayer: () => {
    show: (payload: {
      rect?: PreviewPlayerRect
      width?: number
      ratio?: number
      url?: string
    }) => void
  }
}

declare global {
  interface Window {
    DialoguePlayer?: DialoguePlayerModule
  }
}

export const config: PlasmoCSConfig = {
  matches: [
"https://*/*"
  ]
}

type MatchPayload = Record<string, unknown>

console.log("[content] script executing on", window.location.href)

const MATCH_MAP_SCRIPT_ID = "sl-match-map-data"
let cachedMatchMap: MatchPayload[] | null = null
const PLAYER_SCRIPT_ID = "dialogue-player-component"
let playerModulePromise: Promise<typeof window.DialoguePlayer> | null = null
let activeVisitorPlayer: ReturnType<typeof window.DialoguePlayer["initVisitorPlayer"]> | null = null

const loadPlayerComponent = () => {
  if (window.DialoguePlayer) {
    return Promise.resolve(window.DialoguePlayer)
  }
  if (playerModulePromise) {
    return playerModulePromise
  }
  playerModulePromise = new Promise((resolve) => {
    const existing = document.getElementById(PLAYER_SCRIPT_ID) as HTMLScriptElement | null
    if (existing) {
      existing.addEventListener(
        "load",
        () => resolve(window.DialoguePlayer),
        { once: true }
      )
      existing.addEventListener(
        "error",
        () => resolve(window.DialoguePlayer),
        { once: true }
      )
      return
    }
    const script = document.createElement("script")
    script.id = PLAYER_SCRIPT_ID
    script.src = chrome.runtime.getURL("static/player.js")
    script.async = true
    script.onload = () => resolve(window.DialoguePlayer)
    script.onerror = () => resolve(window.DialoguePlayer)
    document.head.appendChild(script)
  })
  return playerModulePromise
}

const ensureVisitorPlayer = async () => {
  if (activeVisitorPlayer) {
    return activeVisitorPlayer
  }
  const module = await loadPlayerComponent()
  if (!module?.initVisitorPlayer) {
    return null
  }
  activeVisitorPlayer = module.initVisitorPlayer()
  return activeVisitorPlayer
}

const DEFAULT_PREVIEW_RECT = () => ({
  left: Math.max(12, window.innerWidth - 340),
  bottom: 72,
  width: 0,
  height: 0,
})

const previewLibraryVideo = async (__url?: string, rect?: PreviewPlayerRect | null, width?: number, ratio?: number) => {
  const url = __url || ""
  if (!url) return
  const player = await ensureVisitorPlayer()
  if (!player) return
  player.show({
    rect: rect ?? DEFAULT_PREVIEW_RECT(),
    width: width ?? 320,
    ratio: ratio ?? 16 / 9,
    url,
  })
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
    previewLibraryVideo(request.videoUrl)
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

const invokePageScriptRemoval = (matchId: number | string | undefined | null) => {
  if (!matchId) return
  const removeFn = (window as any).__SL_removeMatchHighlight
  if (typeof removeFn === "function") {
    removeFn(matchId)
  }
}
