const template = document.createElement('template');
template.innerHTML = `
  <style>
    :host {
      display: block;
      font-family: var(--sl-font-stack, "Inter",-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif);
    }

    .grid-shell {
      border-radius: 16px;
      border: 1px solid #e5e7eb;
      background: #fff;
      overflow: hidden;
      display: flex;
      flex-direction: column;
      height: 100%;
    }

    .grid-header {
      padding: 16px 20px 12px;
      font-size: 13px;
      letter-spacing: 0.08em;
      text-transform: uppercase;
      color: #475467;
      font-weight: 600;
      border-bottom: 1px solid #edf2f7;
    }

    .grid-content {
      flex: 1;
      overflow-y: auto;
      padding: 12px 16px 16px;
    }

    .grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(160px, 1fr));
      gap: 12px;
    }

    .doc-card {
      display: flex;
      flex-direction: column;
      border-radius: 12px;
      border: 1px solid #e2e8f0;
      overflow: hidden;
      background: #f8fafc;
      min-height: 150px;
      box-shadow: 0 8px 20px rgba(15, 23, 42, 0.1);
    }

    .doc-cover {
      width: 100%;
      height: 90px;
      background-color: #cbd5f5;
      background-size: cover;
      background-position: center;
      flex-shrink: 0;
    }

    .doc-content {
      padding: 10px 12px;
      flex: 1;
      display: flex;
      flex-direction: column;
      gap: 4px;
    }

    .doc-title {
      font-size: 14px;
      font-weight: 600;
      color: #0f172a;
      line-height: 1.3;
      margin: 0;
      flex: 1;
      overflow: hidden;
      text-overflow: ellipsis;
    }

    .doc-meta {
      font-size: 12px;
      color: #475467;
      display: flex;
      justify-content: space-between;
      gap: 4px;
    }

    .doc-meta span {
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }

    .doc-meta a {
      color: inherit;
      text-decoration: none;
    }

    .empty {
      padding: 20px;
      color: #94a3b8;
      font-size: 14px;
      text-align: center;
    }
  </style>
  <div class="grid-shell">
    <div class="grid-header">Video library</div>
    <div class="grid-content">
      <div class="grid"></div>
    </div>
  </div>
`;

class ProviderDocumentsGrid extends HTMLElement {
  constructor() {
    super();
    this.attachShadow({ mode: 'open' }).appendChild(template.content.cloneNode(true));
    this._documents = [];
  }

  set documents(items) {
    this._documents = Array.isArray(items) ? items : [];
    this.render();
  }

  get documents() {
    return this._documents;
  }

  render() {
    const grid = this.shadowRoot.querySelector('.grid');
    if (!grid) return;

    if (!this._documents.length) {
      grid.innerHTML = '<div class="empty">No provider documents to show.</div>';
      return;
    }

    grid.innerHTML = this._documents.map(doc => `
      <article class="doc-card">
        <div
          class="doc-cover"
          style="background-image: url('${doc.cover_image_url || ''}');"
        ></div>
        <div class="doc-content">
          <h3 class="doc-title">${doc.title || 'Untitled document'}</h3>
          <div class="doc-meta">
            <span>${doc.media_type || 'Unknown'}</span>
            <a href="${doc.source_url || '#'}" target="_blank" rel="noreferrer noopener">
              View
            </a>
          </div>
        </div>
      </article>
    `).join('');
  }
}

customElements.define('provider-documents-grid', ProviderDocumentsGrid);
