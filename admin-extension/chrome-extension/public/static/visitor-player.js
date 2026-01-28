import { buildPlayerNode } from "./player-base.js"

function initVisitorPlayer() {
  const playerNode = buildPlayerNode()
  if (!playerNode) {
    console.warn("[dialogue-player] failed to build node")
    return null
  }
  playerNode.classList.add("visitor-player")

  const container = playerNode.querySelector(".d-media-container")
  const iframe = playerNode.querySelector("#dialogue-player-iframe")
  document.body.appendChild(playerNode)

  const setVisible = (visible) => {
    playerNode.classList.toggle("visible", visible)
  }

  const loadVideo = (url) => {
    if (!iframe) return
    iframe.src = url || ""
  }

  const position = (rect) => {
    if (!rect) return
    const offsetY = 12
    const playerWidth = playerNode.offsetWidth || 320
    const rectLeft = window.scrollX + rect.left
    const maxLeft = Math.max(12, window.innerWidth - playerWidth - 12)
    const constrainedLeft = Math.min(Math.max(rectLeft, 12), maxLeft)
    playerNode.style.left = `${constrainedLeft}px`
    playerNode.style.top = `${window.scrollY + rect.bottom + offsetY}px`
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

  const show = ({ rect, width, ratio, url }) => {
    size(width, ratio)
    position(rect)
    if (url) {
      loadVideo(url)
    }
    setVisible(true)
  }

  const hide = () => {
    setVisible(false)
    if (iframe) {
      iframe.src = ""
    }
  }

  const clickHandler = (event) => {
    if (playerNode.contains(event.target)) return
    hide()
  }
  document.addEventListener("mousedown", clickHandler)

  return {
    show,
    hide,
    size,
    loadVideo,
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
