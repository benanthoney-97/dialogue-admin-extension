export {}

console.log("BACKGROUND: Service Worker Loaded!")

chrome.sidePanel
  .setPanelBehavior({ openPanelOnActionClick: true })
  .then(() => console.log("BACKGROUND: Panel behavior set."))
  .catch((e) => console.error(e))

type MatchPayload = Record<string, unknown>
let latestMatch: MatchPayload | null = null

const DECISION_API = "http://localhost:4173/api/decision-data"

const buildDecisionDataUrl = (match: MatchPayload) => {
  const params = new URLSearchParams()
  if (match.provider_id) params.set("provider_id", String(match.provider_id))
  if (match.document_id) params.set("document_id", String(match.document_id))
  if (match.knowledge_id) params.set("knowledge_id", String(match.knowledge_id))
  if (match.phrase) params.set("phrase", String(match.phrase))
  return `${DECISION_API}?${params.toString()}`
}

const fetchDecisionData = async (match: MatchPayload) => {
  const url = buildDecisionDataUrl(match)
  try {
    console.log("[background] fetching decision data", url)
    const response = await fetch(url)
    if (!response.ok) {
      throw new Error(`Decision data fetch failed (${response.status})`)
    }
    const data = await response.json()
    return {
      ...match,
      ...data
    }
  } catch (error) {
    console.error("decision-data fetch error", error)
    return match
  }
}

const notifyMatchData = (payload: MatchPayload) => {
  chrome.runtime.sendMessage({ action: "matchData", match: payload }, () => {
    if (chrome.runtime.lastError) {
      console.warn("[background] notifyMatchData error", chrome.runtime.lastError.message)
    }
  })
}

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  console.log("[background] received message", message)
  if (message.action === "matchClicked") {
    console.log("[background] matchClicked", message.match)
    const tabId = sender.tab?.id
    if (tabId) {
      chrome.sidePanel.open({ tabId }, () => {})
    } else {
      chrome.sidePanel.open({}, () => {})
    }
    fetchDecisionData(message.match).then((data) => {
      latestMatch = data
      notifyMatchData(data)
    })
    return false
  }

  if (message.action === "getLatestMatch") {
    sendResponse({ match: latestMatch })
    return true
  }

  return false
})
