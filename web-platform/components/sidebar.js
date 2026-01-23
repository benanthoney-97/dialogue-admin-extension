const SIDEBAR_TEMPLATE_PATH = new URL("./sidebar.html", import.meta.url).href
const EXPANDED_WIDTH = 220
const COLLAPSED_WIDTH = 72

const injectSidebar = async (slotSelector) => {
  const slot = document.querySelector(slotSelector)
  if (!slot) return null

  try {
    const response = await fetch(SIDEBAR_TEMPLATE_PATH)
    const html = await response.text()
    slot.innerHTML = html
    return slot
  } catch (error) {
    console.warn("Unable to load sidebar markup:", error)
    return null
  }
}

const attachToggle = (slot) => {
  const sidebar = slot.querySelector(".sidebar")
  const toggle = slot.querySelector("#sidebar-toggle")
  if (!sidebar || !toggle) return

  const setSidebarWidth = (width) => {
    document.documentElement.style.setProperty("--sidebar-width", `${width}px`)
  }

  toggle.addEventListener("click", () => {
    const isExpanded = toggle.getAttribute("aria-expanded") === "true"
    sidebar.classList.toggle("collapsed")
    const nextWidth = isExpanded ? COLLAPSED_WIDTH : EXPANDED_WIDTH
    setSidebarWidth(nextWidth)
    toggle.setAttribute("aria-expanded", String(!isExpanded))
  })
}

export async function loadSidebar(slotSelector = "#sidebar-slot") {
  const slot = await injectSidebar(slotSelector)
  if (slot) {
    attachToggle(slot)
  }
}
