import type { PlasmoCSConfig } from "plasmo"

type MatchPayload = Record<string, unknown>

export const config: PlasmoCSConfig = {
  matches: ["https://*/*"],
}

const MATCH_MAP_SCRIPT_ID = "sl-match-map-data"
let cachedMatchMap: MatchPayload[] | null = null


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
  const match = getMatchMap()[matchIndex]
  if (!match) {
    return
  }

  const targetIsVisitor = document.documentElement?.classList.contains("sl-visitor-mode") ||
    document.body?.classList.contains("sl-visitor-mode")
  if (targetIsVisitor) {
    return
  }

  const payload: MatchPayload = {
    ...match,
    page_match_id: match.page_match_id ?? match.id ?? null
  }
  chrome.runtime.sendMessage({ action: "matchClicked", match }, (response) => {
    const err = chrome.runtime.lastError
    if (err) {
    } else {
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
  const index = Number(target.getAttribute("data-match-index"))
  if (!Number.isNaN(index)) {
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
    invokePageScriptRemoval(id)
    return false
  }
  if (request.action === "scrollToMatch") {
    if (typeof request.matchId === "number") {
      scrollToMatchHighlight(request.matchId)
    }
    return false
  }
  if (request.action === "pageReady") {
    chrome.runtime.sendMessage({ action: "pageReadyAck" }, () => {})
    return false
  }

  if (request.action === "read_page") {
    const content = document.body.innerText || ""

    sendResponse({
      title: document.title,
      url: window.location.href,
      content: content.replace(/\s+/g, " ").trim()
    })

    return false
  }

  return false
})

const handleCreateMatchEvent = (event: Event) => {
  const detail = (event as CustomEvent).detail
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

const scrollToMatchHighlight = (matchId: number) => {
  const selector = `[data-page-match-id="${matchId}"]`
  const attempt = (tries = 0) => {
    const element = document.querySelector(selector)
    if (element) {
      element.scrollIntoView({ behavior: "smooth", block: "center" })
      return
    }
    if (tries >= 5) {
      return
    }
    window.setTimeout(() => attempt(tries + 1), 300)
  }
  attempt()
}

setTimeout(() => {
  chrome.runtime?.sendMessage?.({ action: "pageReady" }, (response) => {
    if (response?.matchId) {
      scrollToMatchHighlight(response.matchId)
    }
  })
}, 0)
