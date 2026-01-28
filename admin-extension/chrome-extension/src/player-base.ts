export const PLAYER_TEMPLATE_HTML = `
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
    .visitor-player #dialogue-create-match,
    .visitor-player #dialogue-meta-timestamp,
    .visitor-player .d-player-footer {
      display: none;
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
      <span class="d-meta-text">Related video</span>
      <div class="resize-handle" id="dialogue-resize-handle"></div>
    </div>
    <div class="d-player-footer">
      <span id="dialogue-meta-timestamp">0:00</span>
      <button id="dialogue-create-match" type="button" disabled>Create match at 0:00</button>
    </div>
  </div>
`

export const buildPlayerNode = (): HTMLElement | null => {
  const template = document.createElement("template")
  template.innerHTML = PLAYER_TEMPLATE_HTML
  const styleElement = template.content.querySelector("style")
  if (styleElement) {
    document.head.appendChild(styleElement)
  }
  return template.content.querySelector("#dialogue-nano-player")
}
