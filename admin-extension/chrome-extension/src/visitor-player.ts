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

declare global {
  interface Window {
    DialoguePlayerTemplate?: {
      buildPlayerNode: () => HTMLElement | null
    }
  }
}

const buildPlayerNode = () => {
  if (!window.DialoguePlayerTemplate?.buildPlayerNode) {
    console.warn("[visitor-player] shared player template not available")
    return null
  }
  return window.DialoguePlayerTemplate.buildPlayerNode()
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

  const position = (rect?: RectLike | DOMRect) => {
    if (!rect) return
    const offsetY = 12
    const playerWidth = playerNode.offsetWidth || 320
    const domRect = toDomRect(rect)
    if (!domRect) return
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

  const show = ({ rect, width, ratio, url, metadata }: PlayerOptions) => {
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
