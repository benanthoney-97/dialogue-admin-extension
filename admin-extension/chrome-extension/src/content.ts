import type { PlasmoCSConfig } from "plasmo"
console.log("[content] content script loaded")

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
  if (request.action === "scrollToMatch") {
    if (typeof request.matchId === "number") {
      console.log("[content] scrollToMatch received", request.matchId)
      scrollToMatchHighlight(request.matchId)
    }
    return false
  }
  if (request.action === "pageReady") {
    console.log("[content] pageReady message received")
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

const scrollToMatchHighlight = (matchId: number) => {
  const selector = `[data-page-match-id="${matchId}"]`
  const attempt = (tries = 0) => {
    const element = document.querySelector(selector)
    if (element) {
      console.log("[content] scrolling to match element", { selector, matchId, tries })
      element.scrollIntoView({ behavior: "smooth", block: "center" })
      return
    }
    if (tries >= 5) {
      console.warn("[content] no match element found after retries", { selector, matchId })
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
