import { showCodePopup } from "./code-popup.js"

const TOPBAR_TEMPLATE_PATH = new URL("./topbar.html", import.meta.url).href

const injectTopbar = async (slotSelector) => {
  const slot = document.querySelector(slotSelector)
  if (!slot) return null

  try {
    const response = await fetch(TOPBAR_TEMPLATE_PATH)
    const html = await response.text()
    slot.innerHTML = html
    return slot
  } catch (error) {
    console.warn("Unable to load topbar markup:", error)
    return null
  }
}

const setTitle = (slot, title) => {
  if (!title) return
  const titleElement = slot.querySelector('[data-role="title"]')
  if (titleElement) {
    titleElement.textContent = title
  }
}

const attachActions = (slot, options = {}) => {
  const codeLink = slot.querySelector('[data-action="show-code-popup"]')
  if (!codeLink) return

  const providerId =
    Number(codeLink.dataset.providerId) ||
    Number(options.providerId) ||
    Number(slot.dataset.providerId) ||
    12

  codeLink.addEventListener("click", (event) => {
    event.preventDefault()
    showCodePopup({ providerId })
  })
}

export async function loadTopbar(slotSelector = "#topbar-slot", options = {}) {
  const slot = await injectTopbar(slotSelector)
  if (slot) {
    const title =
      options.title ||
      slot.dataset.pageTitle ||
      slot.getAttribute("data-page-title") ||
      slot.dataset.page ||
      ""
    setTitle(slot, title)
    attachActions(slot, options)
  }
  return slot
}
