import { supabase } from "../../lib/supabase"

const template = document.createElement("template")
template.innerHTML = `
  <style>
    :host {
      display: block;
      font-family: inherit;
    }

    .providers-grid {
      border-radius: 16px;
      padding: 16px;
      display: flex;
      flex-direction: column;
      gap: 12px;
      min-height: 120px;
    }

    .providers-grid__title {
      font-size: 15px;
      font-weight: 600;
      color: #0f172a;
      letter-spacing: 0.01em;
    }

    .providers-grid__list {
      display: grid;
      grid-template-columns: repeat(2, minmax(0, 1fr));
      gap: 10px;
    }

    .providers-grid__item {
      display: flex;
      align-items: center;
      gap: 12px;
      padding: 10px 0;
      border-radius: 12px;
      cursor: pointer;
      transition: background 0.2s ease;
      width: 100%;
    }

    .providers-grid__item:focus-visible,
    .providers-grid__item:hover {
      background: #f1f5f9;
      outline: none;
    }

    .providers-grid__logo {
      width: 40px;
      height: 40px;
      border-radius: 999px;
      background: #e0e7ff;
      display: flex;
      align-items: center;
      justify-content: center;
      overflow: hidden;
      flex-shrink: 0;
    }

    .providers-grid__logo img {
      width: 100%;
      height: 100%;
      object-fit: contain;
    }

    .providers-grid__logo span {
      font-size: 14px;
      font-weight: 600;
      color: #0f172a;
    }

    .providers-grid__name {
      font-size: 14px;
      font-weight: 600;
      color: #0f172a;
    }

    .providers-grid__state {
      font-size: 13px;
      color: #64748b;
      text-align: center;
      padding: 14px;
      border-radius: 10px;
    }
  </style>
  <div class="providers-grid">
    <div class="providers-grid__title">Supabase providers</div>
    <div class="providers-grid__list">
      <div class="providers-grid__state">Loading providers…</div>
    </div>
  </div>
`

class ProvidersGrid extends HTMLElement {
  constructor() {
    super()
    this.attachShadow({ mode: "open" }).appendChild(template.content.cloneNode(true))
    this.listElement = this.shadowRoot.querySelector(".providers-grid__list")
  }

  connectedCallback() {
    this.fetch()
  }

  async fetch() {
    this.showState("loading")
    try {
      const { data, error } = await supabase
        .from("providers")
        .select("id,name,logo_url")
        .order("name", { ascending: true })

      if (error) {
        throw error
      }

      this.renderProviders(data ?? [])
    } catch (error) {
      console.error("[providers-grid] failed to fetch providers", error)
      this.showState("error")
    }
  }

  showState(state) {
    if (!this.listElement) return
    let message = ""
    switch (state) {
      case "loading":
        message = "Loading providers…"
        break
      case "empty":
        message = "No providers found."
        break
      default:
        message = "Unable to load providers."
    }
    this.listElement.innerHTML = `<div class="providers-grid__state">${message}</div>`
  }

  renderProviders(providers) {
    if (!this.listElement) return
    if (!providers.length) {
      this.showState("empty")
      return
    }

    this.listElement.innerHTML = ""
    providers.forEach((provider) => {
      const item = document.createElement("article")
      item.className = "providers-grid__item"
      item.setAttribute("role", "button")
      item.tabIndex = 0

      const logoWrapper = document.createElement("div")
      logoWrapper.className = "providers-grid__logo"

      if (provider.logo_url) {
        const img = document.createElement("img")
        img.src = provider.logo_url
        img.alt = provider.name ? `${provider.name} logo` : "Provider logo"
        img.loading = "lazy"
        img.addEventListener("error", () => {
          this.renderInitials(logoWrapper, provider.name)
        })
        logoWrapper.appendChild(img)
      } else {
        this.renderInitials(logoWrapper, provider.name)
      }

      const name = document.createElement("div")
      name.className = "providers-grid__name"
      name.textContent = provider.name || "Unnamed provider"

      item.appendChild(logoWrapper)
      item.appendChild(name)
      item.addEventListener("click", () => {
        this.dispatchEvent(
          new CustomEvent("provider-select", { detail: provider, bubbles: true })
        )
      })
      item.addEventListener("keydown", (event) => {
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault()
          item.click()
        }
      })
      this.listElement.appendChild(item)
    })
  }

  renderInitials(logoWrapper, name) {
    logoWrapper.innerHTML = ""
    const placeholder = document.createElement("span")
    placeholder.textContent = this.getInitials(name)
    logoWrapper.appendChild(placeholder)
  }

  getInitials(name) {
    if (!name) return "?"
    return name
      .split(/\s+/)
      .map((part) => part[0])
      .filter(Boolean)
      .join("")
      .slice(0, 2)
      .toUpperCase()
  }
}

customElements.define("providers-grid", ProvidersGrid)
