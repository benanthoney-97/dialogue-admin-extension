const CODE_POPUP_SNIPPET = () => `<script>
  window.__SL_API_ORIGIN = "https://app.dialogue-ai.co";
</script>
<script src="https://app.dialogue-ai.co/admin-script/admin-script.js"></script>
<script>
  if (window.__SL_adminScript && typeof window.__SL_adminScript.init === "function") {
    window.__SL_adminScript.init({
      providerId: [ProviderId],
    });
  }
</script>`

const createPopup = (snippet) => {
  const overlay = document.createElement("div")
  overlay.className = "code-popup-overlay"

  overlay.innerHTML = `
    <div class="code-popup" role="dialog" aria-modal="true">
      <div class="code-popup__header">
        <span>Embed Script</span>
        <button class="code-popup__close" aria-label="Close">&times;</button>
      </div>
      <pre class="code-popup__code"><code data-code></code></pre>
      <div class="code-popup__actions">
        <button class="code-popup__copy" type="button">
          <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" class="bi bi-copy" viewBox="0 0 16 16" aria-hidden="true">
            <path fill-rule="evenodd" d="M4 2a2 2 0 0 1 2-2h8a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2zm2-1a1 1 0 0 0-1 1v8a1 1 0 0 0 1 1h8a1 1 0 0 0 1-1V2a1 1 0 0 0-1-1zM2 5a1 1 0 0 0-1 1v8a1 1 0 0 0 1 1h8a1 1 0 0 0 1-1v-1h1v1a2 2 0 0 1-2 2H2a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h1v1z"/>
          </svg>
          Copy snippet
        </button>
      </div>
    </div>
  `

  const closeButton = overlay.querySelector(".code-popup__close")
  const copyButton = overlay.querySelector(".code-popup__copy")
  const codeElement = overlay.querySelector("[data-code]")

  if (codeElement) {
    codeElement.textContent = snippet
  }

  const removePopup = () => {
    overlay.remove()
  }

  closeButton?.addEventListener("click", removePopup)
  overlay.addEventListener("click", (event) => {
    if (event.target === overlay) {
      removePopup()
    }
  })

  copyButton?.addEventListener("click", async () => {
    if (!snippet) return
    const originalText = copyButton.textContent
    try {
      await navigator.clipboard.writeText(snippet)
      copyButton.textContent = "Copied!"
    } catch {
      const textarea = document.createElement("textarea")
      textarea.value = snippet
      document.body.appendChild(textarea)
      textarea.select()
      document.execCommand("copy")
      document.body.removeChild(textarea)
      copyButton.textContent = "Copied!"
    }
    setTimeout(() => {
      copyButton.textContent = originalText
    }, 2000)
  })

  return { overlay, removePopup }
}

export function showCodePopup(options = {}) {
  const providerId = Number(options.providerId) || 12
  const snippet = CODE_POPUP_SNIPPET(providerId)
  const { overlay, removePopup } = createPopup(snippet)
  document.body.appendChild(overlay)
  return { overlay, close: removePopup }
}
