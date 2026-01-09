import { computeConfidenceChipStyle } from "../confidence-chip/metadata.js"

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
      background: #f6f7fb;
      padding: 20px 24px 24px;
      border: 1px solid rgba(15, 23, 42, 0.08);
      gap: 14px;
    }

    .decision-card-video-wrapper {
      position: relative;
      min-height: 175px;
      display: flex;
      flex-direction: column;
      gap: 8px;
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

    .decision-card-video-meta {
      display: flex;
      flex-direction: column;
      gap: 4px;
      padding: 0 6px 8px;
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

    .decision-card-meta-block {
      display: flex;
      flex-direction: column;
      align-items: flex-start;
      gap: 4px;
      margin-top: 0;
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
      font-size: 11px;
      font-weight: 600;
      color: #0b7c55;
      background: rgba(4, 120, 87, 0.08);
      border-radius: 999px;
      padding: 4px 14px;
      width: fit-content;
      display: inline-flex;
      align-items: center;
      justify-content: center;
      border: 1px solid rgba(4, 120, 87, 0.2);
    }

    .decision-card-phrase-container {
      border: 1px solid #e2e8f0;
      border-radius: 16px;
      background: #ffffff;
      padding: 12px;
      display: flex;
      flex-direction: column;
      gap: 6px;
      position: relative;
    }

    .decision-card-phrase-box {
      width: 100%;
      margin: 0;
      background: #f2f4f7;
      border-radius: 10px;
      padding: 10px;
      box-sizing: border-box;
      overflow: hidden;
    }

    .decision-card-phrase {
      margin: 0;
      font-size: 13px;
      color: #0b0c0d;
      line-height: 1.4;
      max-height: calc(1.4em * 4);
      overflow-y: auto;
      overflow-x: hidden;
      text-overflow: ellipsis;
      word-break: break-word;
    }

    .decision-card-divider-arrow {
      display: flex;
      justify-content: center;
      align-items: center;
      font-size: 18px;
      color: #9ca3af;
      line-height: 1;
    }

    .decision-card-content-wrapper {
      position: relative;
    }

    .decision-card-content {
      font-size: 13px;
      color: #0b0c0d;
      background: #F3E8FF;
      border: none;
      padding: 0;
      line-height: 1.5;
      white-space: pre-wrap;
      word-break: break-word;
      max-height: calc(1.5em * 4);
      overflow-y: auto;
      padding-right: 6px;
      display: block;
      border-radius: 10px;
    }

    .decision-card-chip-row {
      display: flex;
      justify-content: flex-start;
      padding-bottom: 4px;
      gap: 6px;
    }

    .decision-card-chip-row--top {
      padding-bottom: 4px;
    }

    .decision-card-chip {
      padding: 2px 8px;
      border-radius: 999px;
      font-size: 11px;
      font-weight: 600;
      letter-spacing: 0.02em;
    }

    .decision-card-chip--phrase {
      background: #F1F5F9;
      color: #475569;
    }

    .decision-card-chip--content {
      background: #F3E8FF;
      color: #6B21A8;
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

    .actions {
      display: flex;
      flex-direction: row;
      gap: 10px;
          background: #f6f7fb;

    }
    .decision-card-footer {
      position: sticky;
      bottom: 0;
      padding-top: 12px;
      padding-bottom: 12px;
      background: #fff;
      border-top: 1px solid #e5e7f0;
      margin-top: auto;
      width: 100%;
      max-width: 100%;
      box-sizing: border-box;
      left: 0;
      right: 0;
      padding-left: 0;
      padding-right: 0;
      box-shadow: inset 0 1px 0 rgba(15, 23, 42, 0.06);
      background: #f6f7fb;
      overflow: hidden;
    }

    .decision-card-back {
      border: none;
      background: transparent;
      color: #0f172a;
      font-size: 13px;
      font-weight: 600;
      display: inline-flex;
      align-items: center;
      gap: 6px;
      cursor: pointer;
      padding: 0;
      width: 100%;
      align-self: stretch;
      justify-content: flex-start;
    }

    .action {
      flex: 1;
      height: 34px;
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
      background: #047857;
      border-color: #047857;
      color: #ffffff;
      box-shadow: 0 6px 14px rgba(4, 120, 87, 0.35);
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
    <button class="decision-card-back" type="button" aria-label="Back">
      <span aria-hidden="true">←</span>
      <span class="decision-card-back-label">Back</span>
    </button>
    <div class="decision-card-video-wrapper">
      <div class="decision-card-video">
        <div class="sl-iframe-container"></div>
      </div>
      <div class="decision-card-video-meta">
        <div class="decision-card-meta-block">
          <div class="decision-card-meta" aria-live="polite"></div>
          <div class="decision-card-confidence" aria-live="polite"></div>
        </div>
      </div>
    </div>
  <div class="decision-card-phrase-container">
    <div class="decision-card-chip-row decision-card-chip-row--top" aria-hidden="true">
      <span class="decision-card-chip decision-card-chip--phrase">Site text</span>
    </div>
    <div class="decision-card-phrase-box">
      <p class="decision-card-phrase" aria-live="polite"></p>
    </div>
    <div class="decision-card-divider-arrow" aria-hidden="true">
      <span>▼</span>
    </div>
      <div class="decision-card-chip-row" aria-hidden="true">
        <span class="decision-card-chip decision-card-chip--content">Video match</span>
      </div>
    <div class="decision-card-content" aria-live="polite"></div>
    </div>
  </div>
  <div class="decision-card-footer">
    <div class="actions">
      <button type="button" class="action remove" data-action="remove" aria-label="Hide">
      <svg viewBox="0 0 16 16" aria-hidden="true">
        <path d="M2.146 2.854a.5.5 0 1 1 .708-.708L8 7.293l5.146-5.147a.5.5 0 0 1 .708.708L8.707 8l5.147 5.146a.5.5 0 0 1-.708.708L8 8.707l-5.146 5.147a.5.5 0 0 1-.708-.708L7.293 8z"/>
      </svg>
      <span class="action-label">Remove</span>
    </button>
    <button type="button" class="action change" data-action="change" aria-label="Change">
      <svg viewBox="0 0 16 16" aria-hidden="true">
        <path d="M11.534 7h3.932a.25.25 0 0 1 .192.41l-1.966 2.36a.25.25 0 0 1-.384 0l-1.966-2.36a.25.25 0 0 1 .192-.41"/>
        <path fill-rule="evenodd" d="M8 3c-1.552 0-2.94.707-3.857 1.818a.5.5 0 1 1-.771-.636A6.002 6.002 0 0 1 13.917 7H12.9A5 5 0 0 0 8 3M3.1 9a5.002 5.002 0 0 0 8.757 2.182.5.5 0 1 1 .771.636A6.002 6.002 0 0 1 2.083 9z"/>
      </svg>
      <span class="action-label">Replace</span>
    </button>
    <button type="button" class="action approve" data-action="approve" aria-label="Keep">
      <svg viewBox="0 0 16 16" aria-hidden="true">
        <path d="M13.854 3.646a.5.5 0 0 1 0 .708l-7 7a.5.5 0 0 1-.708 0l-3.5-3.5a.5.5 0 1 1 .708-.708L6.5 10.293l6.646-6.647a.5.5 0 0 1 .708 0"/>
      </svg>
      <span class="action-label">Approve</span>
    </button>
    </div>
  </div>
`;

class DecisionCard extends HTMLElement {
  static get observedAttributes() {
    return [
      "data-title",
      "data-confidence",
      "data-video",
      "data-knowledge-id",
      "data-content",
      "data-phrase",
      "data-confidence-label",
      "data-confidence-color",
      "data-page-match-id",
      "data-back-label",
      "data-back-aria-label"
    ];
  }

  constructor() {
    super();
    this.attachShadow({ mode: "open" }).appendChild(template.content.cloneNode(true));
    this.handleClick = this.handleClick.bind(this);
    this.metaEl = null;
    this.confidenceEl = null;
    this.videoEl = null;
    this.iframeContainer = null;
    this.contentEl = null;
    this.phraseEl = null;
    this.backButton = null;
    this.backLabelEl = null;
    this.handleBackClick = this.handleBackClick.bind(this);
    this.knowledgeId = null;
    this.pageMatchId = null;
    this.rawConfidenceValue = null;
    this.confidenceLabelValue = "";
    this.confidenceColorValue = "";
  }

  connectedCallback() {
    this.shadowRoot.addEventListener("click", this.handleClick);
    this.metaEl = this.shadowRoot.querySelector(".decision-card-meta");
    this.confidenceEl = this.shadowRoot.querySelector(".decision-card-confidence");
    this.contentEl = this.shadowRoot.querySelector(".decision-card-content");
    this.videoEl = this.shadowRoot.querySelector(".decision-card-video");
    this.iframeContainer = this.shadowRoot.querySelector(".sl-iframe-container");
    this.phraseEl = this.shadowRoot.querySelector(".decision-card-phrase");
    this.backButton = this.shadowRoot.querySelector(".decision-card-back");
    this.backLabelEl = this.shadowRoot.querySelector(".decision-card-back-label");
    this.syncAttributes();
    this.updateBackLabel(this.getAttribute("data-back-label"));
    this.updateBackAriaLabel(this.getAttribute("data-back-aria-label"));
    if (this.backButton) {
      this.backButton.addEventListener("click", this.handleBackClick);
    }
  }

  disconnectedCallback() {
    this.shadowRoot.removeEventListener("click", this.handleClick);
    if (this.backButton) {
      this.backButton.removeEventListener("click", this.handleBackClick);
    }
  }

  attributeChangedCallback(name, oldValue, newValue) {
    if (oldValue === newValue) return;
    if (name === "data-title") this.updateTitle(newValue);
    if (name === "data-confidence") this.updateConfidence(newValue);
    if (name === "data-phrase") this.updatePhrase(newValue);
    if (name === "data-video") this.updateVideo(newValue);
    if (name === "data-knowledge-id") this.updateKnowledgeId(newValue);
    if (name === "data-content") this.updateContent(newValue);
    if (name === "data-confidence-label") this.updateConfidenceLabel(newValue);
    if (name === "data-confidence-color") this.updateConfidenceColor(newValue);
    if (name === "data-page-match-id") this.updatePageMatchId(newValue);
    if (name === "data-back-label") this.updateBackLabel(newValue);
    if (name === "data-back-aria-label") this.updateBackAriaLabel(newValue);
  }

  updatePageMatchId(value) {
    const id = Number(value);
    this.pageMatchId = Number.isNaN(id) ? null : id;
  }

  updateBackLabel(value) {
    if (!this.backLabelEl) return;
    this.backLabelEl.textContent = value || "Back";
  }

  updateBackAriaLabel(value) {
    if (!this.backButton) return;
    if (value) {
      this.backButton.setAttribute("aria-label", value);
    } else {
      this.backButton.setAttribute("aria-label", "Back");
    }
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
    this.rawConfidenceValue = value;
    this.renderConfidence();
  }

  updateConfidenceLabel(value) {
    this.confidenceLabelValue = (value || "").trim();
    this.renderConfidence();
  }

  renderConfidence() {
    if (!this.confidenceEl) return;
    if (this.confidenceLabelValue) {
      this.confidenceEl.textContent = this.confidenceLabelValue;
    } else {
      const formatted = this.formatConfidence(this.rawConfidenceValue);
      this.confidenceEl.textContent = formatted;
    }
    this.applyConfidenceStyling();
  }

  updateConfidenceColor(value) {
    this.confidenceColorValue = (value || "").trim();
    this.renderConfidence();
  }

  applyConfidenceStyling() {
    if (!this.confidenceEl) return;
    const { background, borderColor, color } = computeConfidenceChipStyle(
      this.confidenceLabelValue,
      this.confidenceColorValue
    );
    this.confidenceEl.style.background = background;
    this.confidenceEl.style.borderColor = borderColor;
    this.confidenceEl.style.color = color;
  }

  updatePhrase(value) {
    if (!this.phraseEl) return;
    this.phraseEl.textContent = value || "";
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
    this.contentEl.style.display = raw ? "block" : "none";
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

  handleBackClick() {
    this.dispatchEvent(new CustomEvent("decision-back", { bubbles: true }));
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
      // Parent handles deletion/confirmation
    }
    if (action === "approve") {
      this.markMatchStatus("active");
      this.restoreMatchHighlight();
    }
  }

  async markMatchStatus(status) {
    if (!this.pageMatchId) {
      return;
    }
    try {
      const API_ORIGIN =
        window.__SL_API_ORIGIN ||
        process.env.API_ORIGIN ||
        `${window.location.protocol}//${window.location.host}`;
      const response = await fetch(`${API_ORIGIN}/api/page-match-status`, {
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
    } catch (err) {
    }
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
      return;
    }
    chrome.runtime.sendMessage({ action: "restoreMatchHighlight", match: payload });
  }
}

customElements.define('decision-card', DecisionCard);
