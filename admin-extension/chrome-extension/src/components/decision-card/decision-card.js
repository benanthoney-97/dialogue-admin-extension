const template = document.createElement('template');
template.innerHTML = `
  <style>
    :host {
      display: flex;
      flex-direction: column;
      align-items: stretch;
      justify-content: flex-start;
      font-family: inherit;
      width: 100%;
      height: 100%;
      border-radius: 12px 12px 0 0;
      background: #ffffff;
      box-shadow: 0 35px 120px rgba(15, 23, 42, 0.25);
      padding: 20px 24px 24px;
      border: 1px solid rgba(15, 23, 42, 0.08);
      gap: 14px;
    }

    .decision-card-video-wrapper {
      position: relative;
      min-height: 175px;
    }

    .status-pill {
      position: absolute;
      top: 12px;
      left: 12px;
      background: #e5f8f2;
      color: #0b7c55;
      font-size: 11px;
      font-weight: 600;
      padding: 4px 12px;
      border-radius: 999px;
      text-transform: capitalize;
      letter-spacing: 0.02em;
      z-index: 3;
      border: 1px solid #20c997;
      display: inline-flex;
      align-items: center;
      justify-content: center;
      white-space: nowrap;
      max-width: fit-content;
    }
    .status-pill.inactive {
      background: #ffecec;
      border-color: #ff6b6b;
      color: #ae2d1d;
    }

    .decision-card-video {
      width: 100%;
      border-radius: 24px;
      overflow: hidden;
      position: relative;
      background: #000;
      display: none;
      flex-direction: column;
      height: 175px;
      animation: fadeIn 0.25s ease;
    }

    .decision-card-video.open {
      display: flex;
            border-radius: 12px;

    }

    .sl-iframe-container {
      position: absolute;
      top: 0;
      left: 0;
      width: 100%;
      height: 100%;
    }

    .sl-iframe-container iframe {
      width: 100%;
      height: 100%;
      border: none;
    }

    .decision-card-meta {
      text-align: left;
      width: 100%;
      font-weight: 700;
      font-size: 18px;
      line-height: 1.4;
      color: #111827;
      display: -webkit-box;
      -webkit-line-clamp: 2;
      -webkit-box-orient: vertical;
      overflow: hidden;
      text-overflow: ellipsis;
    }

    .decision-card-confidence {
      margin: 0;
      font-size: 14px;
      font-weight: 600;
      color: #0b7c55;
      background: rgba(32, 201, 151, 0.12);
      border-radius: 999px;
      padding: 4px 10px;
      width: fit-content;
    }

    .decision-card-content {
      font-size: 13px;
      color: #475467;
      background: #f8fafc;
      border-radius: 12px;
      padding: 10px 12px;
      line-height: 1.5;
      white-space: pre-wrap;
      word-break: break-word;
      margin-top: 4px;
      display: block;
      max-height: 6.8em;
      overflow-y: auto;
      padding-right: 8px;
      padding-top: 0;
      position: relative;
    }

    .decision-card-content::-webkit-scrollbar {
      width: 6px;
    }

    .decision-card-content::-webkit-scrollbar-track {
      background: transparent;
    }

    .decision-card-content::-webkit-scrollbar-thumb {
      background: rgba(15, 23, 42, 0.3);
      border-radius: 999px;
    }

    .snippet-shell {
      padding-bottom: 8px;
      display: flex;
      justify-content: flex-start;
      align-items: center;
      gap: 6px;
    }

    .snippet-toggle {
      width: auto;
      border: none;
      background: transparent;
      color: #475467;
      display: flex;
      align-items: center;
      gap: 6px;
      padding: 0;
      font-weight: 600;
      cursor: pointer;
    }

    .snippet-icon {
      display: inline-flex;
      align-items: center;
      justify-content: center;
    }

    .snippet-icon-up {
      display: none;
    }

    .snippet-toggle[aria-expanded="true"] .snippet-icon-down {
      display: none;
    }

    .snippet-toggle[aria-expanded="true"] .snippet-icon-up {
      display: inline-flex;
    }



    .actions {
      display: flex;
      flex-direction: column;
      gap: 10px;
    }

    .action {
      width: 100%;
      height: 40px;
      border-radius: 10px;
      border: 1px solid transparent;
      background: #f8fafc;
      display: inline-flex;
      align-items: center;
      justify-content: center;
      cursor: pointer;
      transition: transform 0.2s ease, box-shadow 0.2s ease, background 0.2s ease;
      font-size: 14px;
      font-weight: 600;
      gap: 8px;
    }
    .action-label {
      margin: 0;
    }

    .action svg {
      width: 20px;
      height: 20px;
      fill: currentColor;
    }

    .action:hover {
      transform: translateY(-1px);
      box-shadow: 0 6px 16px rgba(15, 23, 42, 0.2);
    }

    .approve {
      background: #e5f8f2;
      border-color: #20c997;
      color: #0b7c55;
    }

    .remove {
      background: #ffecec;
      border-color: #ff6b6b;
      color: #ae2d1d;
    }

    .change {
      background: #eef2ff;
      border-color: #7c5afe;
      color: #3b21a9;
    }
    
    @keyframes fadeIn {
      from {
        opacity: 0;
      }
      to {
        opacity: 1;
      }
    }
    
    .decision-card-video-wrapper {
      position: relative;
    }

    </style>
  <div class="decision-card-video-wrapper">
    <div class="status-pill" aria-live="polite"></div>
    <div class="decision-card-video">
      <div class="sl-iframe-container"></div>
    </div>
  </div>
  <div class="decision-card-meta" aria-live="polite"></div>
  <div class="decision-card-confidence" aria-live="polite"></div>
  <div class="actions">
    <button type="button" class="action approve" data-action="approve" aria-label="Keep">
      <svg viewBox="0 0 16 16" aria-hidden="true">
        <path d="M13.854 3.646a.5.5 0 0 1 0 .708l-7 7a.5.5 0 0 1-.708 0l-3.5-3.5a.5.5 0 1 1 .708-.708L6.5 10.293l6.646-6.647a.5.5 0 0 1 .708 0"/>
      </svg>
      <span class="action-label">Keep</span>
    </button>
    <button type="button" class="action remove" data-action="remove" aria-label="Hide">
      <svg viewBox="0 0 16 16" aria-hidden="true">
        <path d="M2.146 2.854a.5.5 0 1 1 .708-.708L8 7.293l5.146-5.147a.5.5 0 0 1 .708.708L8.707 8l5.147 5.146a.5.5 0 0 1-.708.708L8 8.707l-5.146 5.147a.5.5 0 0 1-.708-.708L7.293 8z"/>
      </svg>
      <span class="action-label">Hide</span>
    </button>
    <button type="button" class="action change" data-action="change" aria-label="Change">
      <svg viewBox="0 0 16 16" aria-hidden="true">
        <path d="M11.534 7h3.932a.25.25 0 0 1 .192.41l-1.966 2.36a.25.25 0 0 1-.384 0l-1.966-2.36a.25.25 0 0 1 .192-.41"/>
        <path fill-rule="evenodd" d="M8 3c-1.552 0-2.94.707-3.857 1.818a.5.5 0 1 1-.771-.636A6.002 6.002 0 0 1 13.917 7H12.9A5 5 0 0 0 8 3M3.1 9a5.002 5.002 0 0 0 8.757 2.182.5.5 0 1 1 .771.636A6.002 6.002 0 0 1 2.083 9z"/>
      </svg>
      <span class="action-label">Replace</span>
    </button>
  </div>
  <div class="snippet-shell">
    <button class="snippet-toggle" type="button" aria-expanded="false">
      <span class="snippet-label">Show snippet</span>
      <span class="snippet-icon">
        <svg class="snippet-icon-down" xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" viewBox="0 0 16 16">
          <path d="M7.247 11.14 2.451 5.658C1.885 5.013 2.345 4 3.204 4h9.592a1 1 0 0 1 .753 1.659l-4.796 5.48a1 1 0 0 1-1.506 0z"/>
        </svg>
        <svg class="snippet-icon-up" xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" viewBox="0 0 16 16">
          <path d="m7.247 4.86-4.796 5.481c-.566.647-.106 1.659.753 1.659h9.592a1 1 0 0 0 .753-1.659l-4.796-5.48a1 1 0 0 0-1.506 0z"/>
        </svg>
      </span>
    </button>
  </div>
  <div class="decision-card-content" aria-live="polite"></div>
`;

class DecisionCard extends HTMLElement {
  static get observedAttributes() {
    return [
      "data-title",
      "data-confidence",
      "data-video",
      "data-status",
      "data-knowledge-id",
      "data-content",
      "data-page-match-id"
    ];
  }

  constructor() {
    super();
    this.attachShadow({ mode: "open" }).appendChild(template.content.cloneNode(true));
    this.handleClick = this.handleClick.bind(this);
    this.metaEl = null;
    this.confidenceEl = null;
    this.statusEl = null;
    this.videoEl = null;
    this.iframeContainer = null;
    this.contentEl = null;
    this.snippetButton = null;
    this.snippetLabel = null;
    this.snippetVisible = false;
    this.toggleSnippet = this.toggleSnippet.bind(this);
    this.knowledgeId = null;
    this.pageMatchId = null;
  }

  connectedCallback() {
    this.shadowRoot.addEventListener("click", this.handleClick);
    this.metaEl = this.shadowRoot.querySelector(".decision-card-meta");
    this.confidenceEl = this.shadowRoot.querySelector(".decision-card-confidence");
    this.contentEl = this.shadowRoot.querySelector(".decision-card-content");
    this.videoEl = this.shadowRoot.querySelector(".decision-card-video");
    this.iframeContainer = this.shadowRoot.querySelector(".sl-iframe-container");
    this.statusEl = this.shadowRoot.querySelector(".status-pill");
    this.snippetButton = this.shadowRoot.querySelector(".snippet-toggle");
    this.snippetLabel = this.shadowRoot.querySelector(".snippet-label");
    this.syncAttributes();
    this.setSnippetVisibility(false);
    if (this.snippetButton) {
      this.snippetButton.addEventListener("click", this.toggleSnippet);
    }
  }

  disconnectedCallback() {
    this.shadowRoot.removeEventListener("click", this.handleClick);
    if (this.snippetButton) {
      this.snippetButton.removeEventListener("click", this.toggleSnippet);
    }
  }

  attributeChangedCallback(name, oldValue, newValue) {
    if (oldValue === newValue) return;
    if (name === "data-title") this.updateTitle(newValue);
    if (name === "data-confidence") this.updateConfidence(newValue);
    if (name === "data-phrase") this.updatePhrase(newValue);
    if (name === "data-video") this.updateVideo(newValue);
    if (name === "data-status") this.updateStatus(newValue);
    if (name === "data-knowledge-id") this.updateKnowledgeId(newValue);
    if (name === "data-content") this.updateContent(newValue);
    if (name === "data-page-match-id") this.updatePageMatchId(newValue);
  }

  updatePageMatchId(value) {
    const id = Number(value);
    this.pageMatchId = Number.isNaN(id) ? null : id;
  }

  syncAttributes() {
    DecisionCard.observedAttributes.forEach((attr) => {
      const value = this.getAttribute(attr)
      if (value !== null) this.attributeChangedCallback(attr, null, value)
    })
  }

  updateTitle(value) {
    if (!this.metaEl) return;
    this.metaEl.textContent = value || "";
  }

  updateConfidence(value) {
    if (!this.confidenceEl) return;
    const formatted = this.formatConfidence(value);
    this.confidenceEl.textContent = formatted;
  }

    formatConfidence(value) {
    if (value === null || value === undefined || value === "") return "";
    const num = Number(value);
    if (Number.isNaN(num)) return `${value}`;
    const percentage = Math.round(num * 100);
    return `${percentage}% similarity match`;
  }

  updateContent(value) {
    if (!this.contentEl) return;
    const raw = (value || "").trim();
    if (!raw) {
      this.contentEl.textContent = "";
      this.contentEl.style.display = "none";
      return;
    }
    const start = raw.startsWith("...") ? "" : "..."
    const end = raw.endsWith("...") ? "" : "..."
    this.contentEl.textContent = `${start}${raw}${end}`;
    if (this.snippetVisible) {
      this.contentEl.style.display = "block";
    } else {
      this.contentEl.style.display = "none";
    }
  }

  updateStatus(value) {
    if (!this.statusEl) return;
    const raw = (value || "").toString().trim().toLowerCase();
    const normalized = raw === "inactive" ? "inactive" : "active";
    console.log("[decision-card] status value", value, "normalized", normalized);
    this.statusEl.textContent = normalized === "inactive" ? "Hidden" : "Showing";
    this.statusEl.className = `status-pill ${normalized}`;
    console.log("[decision-card] status pill class", this.statusEl.className);
  }

  setSnippetVisibility(visible) {
    if (!this.snippetButton || !this.contentEl || !this.snippetLabel) return;
    this.snippetVisible = visible;
    this.snippetButton.setAttribute("aria-expanded", String(visible));
    this.snippetLabel.textContent = visible ? "Hide snippet" : "Show snippet";
    this.contentEl.style.display = visible ? "block" : "none";
  }

  toggleSnippet() {
    this.setSnippetVisibility(!this.snippetVisible);
  }

  updateVideo(value) {
    if (!this.videoEl || !this.iframeContainer) return;
    const url = value || "";
    this.videoEl.classList.toggle("open", Boolean(url));
    if (!url) {
      this.iframeContainer.innerHTML = "";
      return;
    }
    this.iframeContainer.innerHTML = `<iframe src="${url}" allow="autoplay; fullscreen"></iframe>`;
  }

  updateKnowledgeId(value) {
    const id = Number(value);
    this.knowledgeId = Number.isNaN(id) ? null : id;
  }

  handleClick(event) {
    const button = event.target.closest("button[data-action]");
    if (!button) return;
    const action = button.dataset.action;
    this.dispatchEvent(
      new CustomEvent("decision-select", {
        detail: { action },
        bubbles: true,
        composed: true,
      })
    );
    if (action === "remove") {
      if (this.pageMatchId) {
        chrome.runtime.sendMessage({ action: "removeMatchHighlight", page_match_id: this.pageMatchId })
      }
      this.setLocalStatus("inactive")
      this.markMatchStatus("inactive");
    }
    if (action === "approve") {
      this.setLocalStatus("active")
      this.markMatchStatus("active");
      this.restoreMatchHighlight();
    }
  }

  async markMatchStatus(status) {
    if (!this.pageMatchId) {
      console.log("[decision-card] cannot update status without pageMatchId");
      return;
    }
    console.log("[decision-card] markMatchStatus", status, "pageMatchId", this.pageMatchId);
    try {
      const response = await fetch("http://localhost:4173/api/page-match-status", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          page_match_id: this.pageMatchId,
          status,
        }),
      });
      if (!response.ok) {
        const payload = await response.text();
        throw new Error(`Failed to update match status (${response.status}): ${payload}`);
      }
      console.log("[decision-card] match status updated", status, this.pageMatchId);
    } catch (err) {
      console.error("[decision-card] mark status error", err);
    }
  }

  setLocalStatus(status) {
    if (!this.statusEl) return;
    this.statusEl.textContent = status === "inactive" ? "Hidden" : "Showing";
    this.statusEl.className = `status-pill ${status === "inactive" ? "inactive" : "active"}`;
    this.setAttribute("data-status", status);
    this.updateSpanStatus(status);
  }

  updateSpanStatus(status) {
    if (!this.pageMatchId) return;
    const targetId = String(this.pageMatchId);
    const spans = document.querySelectorAll(`.sl-smart-link[data-page-match-id="${targetId}"]`);
    spans.forEach((span) => {
      span.dataset.matchStatus = status;
      if (status === "inactive") {
        span.classList.add("sl-smart-link--inactive");
        span.style.opacity = "1";
      } else {
        span.classList.remove("sl-smart-link--inactive");
      }
    });
  }

  getMatchPayload() {
    if (!this.pageMatchId) return null;
    const payload = {
      page_match_id: this.pageMatchId,
      title: this.getAttribute("data-title") || "",
      content: this.getAttribute("data-content") || "",
      phrase: this.getAttribute("data-phrase") || "",
      video_url: this.getAttribute("data-video") || "",
      confidence: this.getAttribute("data-confidence") || "",
      knowledge_id: this.getAttribute("data-knowledge-id") || null,
      status: this.getAttribute("data-status") || "active",
    };
    return payload;
  }

  restoreMatchHighlight() {
    const payload = this.getMatchPayload();
    if (!payload) {
      console.warn("[decision-card] cannot restore highlight without payload");
      return;
    }
    console.log("[decision-card] restoring highlight", payload.page_match_id, payload);
    chrome.runtime.sendMessage({ action: "restoreMatchHighlight", match: payload });
  }
}

customElements.define('decision-card', DecisionCard);
