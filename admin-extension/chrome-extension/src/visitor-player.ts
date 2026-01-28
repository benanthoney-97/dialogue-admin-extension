type MatchMetadata = Record<string, unknown>
export type RectLike = Pick<DOMRect, "left" | "bottom" | "width" | "height"> & Partial<Pick<DOMRect, "right" | "top">>

type PlayerOptions = {
  rect?: RectLike | DOMRect
  width?: number
  ratio?: number
  url?: string
  metadata?: MatchMetadata
}

export type VisitorPlayer = {
  show: (options: PlayerOptions) => void
  hide: () => void
  size: (width?: number, ratio?: number) => void
  node: HTMLElement
}

const TEMPLATE_HTML = `
  <style>
    #dialogue-nano-player {
      position: absolute;
      width: 320px;
      background: #fff;
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
      font-weight: 600;
      color: #111;
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
    <div class="d-media-container">
      <iframe id="dialogue-player-iframe" allow="autoplay; fullscreen"></iframe>
    </div>
    <div class="d-meta">
      <span>Preview</span>
      <div class="resize-handle"></div>
    </div>
  </div>
`

const buildPlayerNode = (): HTMLElement | null => {
  const template = document.createElement("template")
  template.innerHTML = TEMPLATE_HTML
  const style = template.content.querySelector("style")
  if (style) {
    document.head.appendChild(style)
  }
  return template.content.querySelector("#dialogue-nano-player") as HTMLElement | null
}

const toDomRect = (value?: RectLike | DOMRect): DOMRect | null => {
  if (!value) return null
  if (value instanceof DOMRect) return value
  return new DOMRect(
    value.left ?? 0,
    value.bottom ?? 0,
    value.width ?? 0,
    value.height ?? 0
  )
}

export function initVisitorPlayer(): VisitorPlayer | null {
  const playerNode = buildPlayerNode()
  if (!playerNode) {
    console.warn("[visitor-player] failed to build node")
    return null
  }
  const container = playerNode.querySelector<HTMLDivElement>(".d-media-container")
  const iframe = playerNode.querySelector<HTMLIFrameElement>("#dialogue-player-iframe")
  document.body.appendChild(playerNode)

  const setVisible = (visible: boolean) => {
    playerNode.classList.toggle("visible", visible)
  }

  const loadVideo = (url?: string) => {
    if (!iframe) return
    iframe.src = url || ""
  }

  const position = (rect?: RectLike | DOMRect) => {
    const domRect = toDomRect(rect)
    if (!domRect) return
    const offsetY = 12
    const playerWidth = playerNode.offsetWidth || 320
    const rectLeft = window.scrollX + domRect.left
    const maxLeft = Math.max(12, window.innerWidth - playerWidth - 12)
    const constrainedLeft = Math.min(Math.max(rectLeft, 12), maxLeft)
    playerNode.style.left = `${constrainedLeft}px`
    playerNode.style.top = `${window.scrollY + domRect.bottom + offsetY}px`
  }

  const size = (width = 320, ratio = 16 / 9) => {
    const clampedWidth = Math.max(width, 260)
    const videoHeight = clampedWidth / ratio
    playerNode.style.width = `${clampedWidth}px`
    playerNode.style.height = `${videoHeight + 40}px`
    if (container) {
      container.style.height = `${videoHeight}px`
    }
  }

  const show = ({ rect, width, ratio, url }: PlayerOptions) => {
    size(width, ratio)
    position(rect)
    if (url) {
      loadVideo(url)
    }
    setVisible(true)
  }

  const hide = () => {
    setVisible(false)
    loadVideo("")
  }

  const handleDocumentClick = (event: MouseEvent) => {
    if (playerNode.contains(event.target as Node)) return
    hide()
  }
  document.addEventListener("mousedown", handleDocumentClick)

  return {
    show,
    hide,
    size,
    node: playerNode,
  }
}
