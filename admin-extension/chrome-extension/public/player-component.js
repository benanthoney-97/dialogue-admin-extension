const TEMPLATE_HTML = `
  <style>
    @keyframes shimmer {
      0% { background-position: 100% 0; }
      100% { background-position: -100% 0; }
    }
    #dialogue-nano-player {
      position: absolute;
      width: 320px;
      background: #ffffff;
      border-radius: 12px;
      box-shadow: 0 10px 40px -10px rgba(0, 0, 0, 0.3);
      overflow: hidden;
      display: flex;
      flex-direction: column;
      z-index: 2147483647;
      opacity: 0;
      pointer-events: none;
      transition: opacity 0.2s ease, transform 0.2s ease;
      transform: translateY(10px);
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
    }
    #dialogue-nano-player.visible {
      opacity: 1;
      pointer-events: auto;
      transform: translateY(0);
    }
    .d-media-container {
      width: 100%;
      height: 180px;
      background: #000;
      position: relative;
    }
    #dialogue-player-iframe {
      position: absolute;
      inset: 0;
      width: 100%;
      height: 100%;
      border: none;
    }
    .d-meta {
      height: 40px;
      background: #fff;
      display: flex;
      align-items: center;
      padding: 0 16px;
      border-top: 1px solid #f0f0f0;
      position: relative;
    }
    .d-player-footer {
      background: #f7f8fb;
      border-top: 1px solid #e4e6f0;
      padding: 12px 16px;
      display: flex;
      flex-direction: column;
      gap: 6px;
    }
    #dialogue-meta-timestamp {
      font-size: 12px;
      font-weight: 600;
      letter-spacing: -0.01em;
      color: #1f2937;
    }
    #dialogue-create-match {
      width: 100%;
      border: none;
      border-radius: 8px;
      padding: 10px 12px;
      font-size: 14px;
      font-weight: 600;
      background: #0f172a;
      color: #fff;
      cursor: pointer;
      transition: opacity 0.2s ease;
    }
    #dialogue-create-match:disabled {
      opacity: 0.5;
      cursor: default;
    }
    .short-format .d-meta {
      display: none;
    }
    .d-meta-text {
      font-size: 12px;
      font-weight: 600;
      color: #111;
      letter-spacing: -0.01em;
    }
    .resize-handle {
      position: absolute;
      width: 20px;
      height: 20px;
      right: 0;
      bottom: 0;
      cursor: se-resize;
      z-index: 30;
    }
  </style>
  <div id="dialogue-nano-player">
    <div class="d-media-container" id="d-container">
      <iframe id="dialogue-player-iframe" allow="autoplay; fullscreen"></iframe>
    </div>
    <div class="d-meta">
      <span class="d-meta-text">Related Video</span>
      <div class="resize-handle" id="dialogue-resize-handle"></div>
    </div>
    <div class="d-player-footer">
      <span id="dialogue-meta-timestamp">0:00</span>
      <button id="dialogue-create-match" type="button" disabled>Create match at 0:00</button>
    </div>
  </div>
`

const buildPlayerNode = () => {
  const template = document.createElement("template")
  template.innerHTML = TEMPLATE_HTML
  const styleElement = template.content.querySelector("style")
  if (styleElement) {
    document.head.appendChild(styleElement)
  }
  return template.content.querySelector("#dialogue-nano-player")
}

function initVisitorPlayer({ onCreateMatch, onClose } = {}) {
  const playerNode = buildPlayerNode()
  const container = playerNode.querySelector(".d-media-container")
  const iframe = playerNode.querySelector("#dialogue-player-iframe")
  const resizeHandle = playerNode.querySelector(".resize-handle")
  document.body.appendChild(playerNode)
  console.log("[player-component] appended player node", playerNode)

  const setVisible = (visible) => {
    playerNode.classList.toggle("visible", visible)
  }

  const metaTimestamp = playerNode.querySelector("#dialogue-meta-timestamp")
  const createMatchButton = playerNode.querySelector("#dialogue-create-match")
  const META_EVENT_NAME = "dialogueCreateMatch"
  let currentMetadata = null
  let currentVideoUrl = ""
  let currentHost = ""
  let currentSeconds = 0
  let timePoll = null
  let youtubeApiPromise = null
  let youtubePlayer = null
  let youtubePlayerReady = false

  const formatTime = (seconds = 0) => {
    const safeSeconds = Math.max(0, Math.floor(seconds))
    const m = Math.floor(safeSeconds / 60)
    const s = safeSeconds % 60
    return `${m}:${s.toString().padStart(2, "0")}`
  }

  const updateButtonLabel = () => {
    if (metaTimestamp) {
      metaTimestamp.textContent = formatTime(currentSeconds)
    }
    if (createMatchButton) {
      const label = `Create match at ${formatTime(currentSeconds)}`
      createMatchButton.textContent = label
      createMatchButton.disabled = !currentMetadata
    }
    console.log("[player-component] updateButtonLabel", {
      button: Boolean(createMatchButton),
      label: createMatchButton?.textContent,
      timestamp: currentSeconds,
      enabled: Boolean(createMatchButton && !createMatchButton.disabled),
    })
  }

  const dispatchCreateMatchEvent = (seconds) => {
    const eventDetail = {
      metadata: currentMetadata,
      timestamp: seconds,
      videoUrl: currentVideoUrl,
    }
    console.log("[player-component] dispatching create match event", eventDetail)
    if (typeof onCreateMatch === "function") {
      onCreateMatch(eventDetail)
    }
    window.dispatchEvent(new CustomEvent(META_EVENT_NAME, { detail: eventDetail }))
  }

  const ensureYouTubeApi = () => {
    if (window.YT?.Player) {
      return Promise.resolve(window.YT)
    }
    if (youtubeApiPromise) {
      return youtubeApiPromise
    }
    youtubeApiPromise = new Promise((resolve) => {
      const callbackName = "__dialogueYTReady"
      window[callbackName] = () => {
        resolve(window.YT)
        delete window[callbackName]
      }
      const script = document.createElement("script")
      script.src = "https://www.youtube.com/iframe_api"
      script.async = true
      const original = window.onYouTubeIframeAPIReady
      window.onYouTubeIframeAPIReady = () => {
        if (typeof original === "function") original()
        if (typeof window[callbackName] === "function") {
          window[callbackName]()
        }
      }
      document.head.appendChild(script)
    })
    return youtubeApiPromise
  }

  const initYouTubePlayer = async () => {
    if (!iframe) return null
    await ensureYouTubeApi()
    if (youtubePlayer) {
      try {
        youtubePlayer.destroy()
      } catch (error) {}
      youtubePlayer = null
    }
    if (!window.YT?.Player) {
      return null
    }
    youtubePlayer = new window.YT.Player(iframe, {
      events: {
        onReady: () => {
          youtubePlayerReady = true
        },
        onStateChange: () => {
          youtubePlayerReady = true
        },
      },
      playerVars: {
        playsinline: 1,
      },
    })
    return youtubePlayer
  }

  const requestYouTubeTime = async () => {
    if (!iframe) return 0
    if (!youtubePlayerReady) {
      await initYouTubePlayer()
    }
    if (youtubePlayer && typeof youtubePlayer.getCurrentTime === "function") {
      try {
        return youtubePlayer.getCurrentTime()
      } catch (error) {}
    }
    return 0
  }

  const requestVimeoTime = () =>
    new Promise((resolve) => {
      if (!iframe || !iframe.contentWindow) {
        return resolve(0)
      }
      const expectedOrigin = "https://player.vimeo.com"
      const listener = (event) => {
        if (event.source !== iframe.contentWindow) return
        if (!String(event.origin).startsWith(expectedOrigin)) return
        let payload = event.data
        if (typeof payload !== "object") {
          try {
            payload = JSON.parse(payload)
          } catch {
            return
          }
        }
        if (!payload || payload.method !== "getCurrentTime") return
        const reported =
          payload.value ??
          payload.seconds ??
          payload.currentTime ??
          payload.data?.currentTime ??
          payload.data?.seconds
        if (reported === undefined || reported === null) return
        window.removeEventListener("message", listener)
        resolve(Math.max(0, reported))
      }
      const timeout = window.setTimeout(() => {
        window.removeEventListener("message", listener)
        resolve(0)
      }, 1500)
      window.addEventListener("message", listener)
      iframe.contentWindow.postMessage(
        {
          method: "getCurrentTime",
          player_id: "dialogue-visitor-player",
          request_id: Math.random().toString(36).slice(2),
        },
        "*"
      )
    })

  const getCurrentTime = async () => {
    if (!currentVideoUrl) return 0
    if (currentHost.includes("youtu")) {
      return requestYouTubeTime()
    }
    if (currentHost.includes("vimeo")) {
      return requestVimeoTime()
    }
    return 0
  }

  const startTimePolling = () => {
    stopTimePolling()
    const update = () => {
      getCurrentTime()
        .then((seconds) => {
          currentSeconds = seconds
          updateButtonLabel()
        })
        .catch(() => {})
    }
    update()
    timePoll = window.setInterval(update, 2000)
  }

  const stopTimePolling = () => {
    if (timePoll) {
      window.clearInterval(timePoll)
      timePoll = null
    }
  }

  const position = (rect) => {
    if (!rect) return
    const offsetY = 12
    const playerWidth = playerNode.offsetWidth
    const rectLeft = window.scrollX + rect.left
    const maxLeft = Math.max(12, window.innerWidth - playerWidth - 12)
    const constrainedLeft = Math.min(Math.max(rectLeft, 12), maxLeft)
    playerNode.style.left = constrainedLeft + "px"
    playerNode.style.top = window.scrollY + rect.bottom + offsetY + "px"
  }

  const size = (width = 320, ratio = 16 / 9) => {
    const MIN_WIDTH = 260
    const FOOTER_HEIGHT = ratio === 9 / 16 ? 0 : 40
    const clampedWidth = Math.max(width, MIN_WIDTH)
    const videoHeight = clampedWidth / ratio
    const isShort = ratio === 9 / 16
    playerNode.style.width = clampedWidth + "px"
    playerNode.style.height = videoHeight + FOOTER_HEIGHT + "px"
    if (container) container.style.height = videoHeight + "px"
    playerNode.classList.toggle("short-format", isShort)
  }

  const loadVideo = (url) => {
    if (!iframe) return
    iframe.src = url || ""
  }

  const show = ({ rect, width, ratio, url, metadata }) => {
    size(width, ratio)
    position(rect)
    if (url) loadVideo(url)
    setVisible(true)
    console.log("[player-component] show called", {
      rect,
      width,
      ratio,
      url,
      metadata,
      buttonExists: Boolean(createMatchButton),
    })
    currentVideoUrl = url || ""
    try {
      currentHost = new URL(currentVideoUrl).hostname.toLowerCase()
    } catch {
      currentHost = ""
    }
    currentMetadata = metadata ?? null
    console.log("[player-component] metadata applied to player", currentMetadata)
    updateButtonLabel()
    if (currentHost.includes("youtu")) {
      initYouTubePlayer().catch(() => {})
    }
    startTimePolling()
  }

  const hide = () => {
    setVisible(false)
    if (iframe) {
      iframe.src = ""
    }
    stopTimePolling()
    currentSeconds = 0
    currentMetadata = null
    currentVideoUrl = ""
    currentHost = ""
    updateButtonLabel()
    if (youtubePlayer) {
      try {
        youtubePlayer.destroy()
      } catch (error) {}
      youtubePlayer = null
      youtubePlayerReady = false
    }
  }

  let isResizing = false

  const handleDocumentClick = (event) => {
    if (isResizing) return
    const target = event.target
    if (playerNode.contains(target)) return
    hide()
  }

  const handleResizeStart = () => {
    isResizing = true
  }

  const handleResizeEnd = () => {
    isResizing = false
  }

  document.addEventListener("mousedown", handleDocumentClick)
  document.addEventListener("touchstart", handleDocumentClick)
  document.addEventListener("mouseup", handleResizeEnd)
  document.addEventListener("touchend", handleResizeEnd)

  if (resizeHandle) {
    resizeHandle.addEventListener("mousedown", handleResizeStart)
    resizeHandle.addEventListener("touchstart", handleResizeStart)
  }

  if (createMatchButton) {
    createMatchButton.addEventListener("click", () => {
      dispatchCreateMatchEvent(currentSeconds)
    })
  }

  return {
    show,
    hide,
    loadVideo,
    position,
    size,
    node: playerNode,
  }
}

const exported = { initVisitorPlayer }
if (typeof window !== "undefined") {
  window.DialoguePlayer = exported
}
if (typeof module !== "undefined" && module.exports) {
  module.exports = exported
}
