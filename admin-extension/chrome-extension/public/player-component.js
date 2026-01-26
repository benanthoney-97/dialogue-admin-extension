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
    .short-format .d-meta {
      display: none;
    }
    .d-meta-text {
      font-size: 13px;
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

  const show = ({ rect, width, ratio, url }) => {
    size(width, ratio)
    position(rect)
    if (url) loadVideo(url)
    setVisible(true)
  }

  const hide = () => setVisible(false)

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
