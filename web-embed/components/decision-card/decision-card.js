const template = document.createElement('template');
template.innerHTML = `
  <style>
    :host {
      display: flex;
      flex-direction: column;
      align-items: stretch;
      justify-content: flex-start;
      font-family: inherit;
      width: min(390px, 90vw);
      max-width: 390px;
      min-height: 624px;
      border-radius: 32px;
      background: #ffffff;
      box-shadow: 0 35px 120px rgba(15, 23, 42, 0.25);
      padding: 20px 24px 24px;
      border: 1px solid rgba(15, 23, 42, 0.08);
      gap: 20px;
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
      margin-top: 4px;
      font-size: 14px;
      font-weight: 600;
      color: #0b7c55;
      background: rgba(32, 201, 151, 0.12);
      border-radius: 999px;
      padding: 4px 10px;
      width: fit-content;
    }

    .decision-card-phrase {
      max-height: 80px;
      overflow-y: auto;
      font-size: 14px;
      line-height: 1.6;
      color: #1f2933;
      padding-right: 4px;
      margin-top: 8px;
    }

    .decision-card-confidence {
      margin-top: 4px;
      font-size: 14px;
      font-weight: 600;
      color: #0b7c55;
      background: rgba(32, 201, 151, 0.12);
      border-radius: 999px;
      padding: 4px 10px;
      width: fit-content;
    }

    .actions {
      display: flex;
      justify-content: center;
      gap: 12px;
      margin-top: auto;
    }

    .action {
      width: 56px;
      height: 56px;
      border-radius: 16px;
      border: 1px solid transparent;
      background: #f8fafc;
      display: inline-flex;
      align-items: center;
      justify-content: center;
      cursor: pointer;
      transition: transform 0.2s ease, box-shadow 0.2s ease, background 0.2s ease;
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
    
  </style>
  <div class="decision-card-video">
    <div class="sl-iframe-container"></div>
  </div>
  <div class="decision-card-meta" aria-live="polite"></div>
  <div class="decision-card-confidence" aria-live="polite"></div>
  <div class="decision-card-phrase" aria-live="polite"></div>
  <div class="actions">
    <button type="button" class="action approve" data-action="approve" aria-label="Approve">
      <svg viewBox="0 0 16 16" aria-hidden="true">
        <path d="M13.854 3.646a.5.5 0 0 1 0 .708l-7 7a.5.5 0 0 1-.708 0l-3.5-3.5a.5.5 0 1 1 .708-.708L6.5 10.293l6.646-6.647a.5.5 0 0 1 .708 0"/>
      </svg>
    </button>
    <button type="button" class="action remove" data-action="remove" aria-label="Remove">
      <svg viewBox="0 0 16 16" aria-hidden="true">
        <path d="M2.146 2.854a.5.5 0 1 1 .708-.708L8 7.293l5.146-5.147a.5.5 0 0 1 .708.708L8.707 8l5.147 5.146a.5.5 0 0 1-.708.708L8 8.707l-5.146 5.147a.5.5 0 0 1-.708-.708L7.293 8z"/>
      </svg>
    </button>
    <button type="button" class="action change" data-action="change" aria-label="Change">
      <svg viewBox="0 0 16 16" aria-hidden="true">
        <path d="M11.534 7h3.932a.25.25 0 0 1 .192.41l-1.966 2.36a.25.25 0 0 1-.384 0l-1.966-2.36a.25.25 0 0 1 .192-.41"/>
        <path fill-rule="evenodd" d="M8 3c-1.552 0-2.94.707-3.857 1.818a.5.5 0 1 1-.771-.636A6.002 6.002 0 0 1 13.917 7H12.9A5 5 0 0 0 8 3M3.1 9a5.002 5.002 0 0 0 8.757 2.182.5.5 0 1 1 .771.636A6.002 6.002 0 0 1 2.083 9z"/>
      </svg>
    </button>
  </div>
`;

class DecisionCard extends HTMLElement {
  constructor() {
    super();
    this.attachShadow({ mode: 'open' }).appendChild(template.content.cloneNode(true));
    this.handleClick = this.handleClick.bind(this);
  }

  connectedCallback() {
    this.shadowRoot.addEventListener('click', this.handleClick);
  }

  disconnectedCallback() {
    this.shadowRoot.removeEventListener('click', this.handleClick);
  }

  handleClick(event) {
    const button = event.target.closest('button[data-action]');
    if (!button) return;
    const action = button.dataset.action;
    this.dispatchEvent(new CustomEvent('decision-select', {
      detail: { action },
      bubbles: true,
      composed: true
    }));
  }
}

customElements.define('decision-card', DecisionCard);
