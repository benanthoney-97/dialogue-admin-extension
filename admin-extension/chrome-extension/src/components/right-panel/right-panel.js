const rightPanelTemplate = document.createElement('template');
rightPanelTemplate.innerHTML = `
  <style>
    :host {
      display: flex;
      flex-direction: column;
      font-family: inherit;
      background: #ffffff;
      border-radius: 0;
      padding: 24px;
      box-shadow: none;
      margin: 0;
      height: 100%;
    }

    h3 {
      margin-top: 0;
      margin-bottom: 16px;
      font-size: 18px;
      color: var(--parent-text, #1a1c23);
    }

    :host > div {
      display: flex;
      flex-direction: column;
      height: 100%;
    }

    table {
      width: 100%;
      border-collapse: collapse;
      table-layout: fixed;
    }

    .table-wrapper {
      flex: 1;
      overflow: auto;
      margin-top: 12px;
      min-height: 0;
      box-shadow: none;
      width: 100%;
      padding-right: 4px;
    }

    th,
    td {
      padding: 10px;
      text-align: left;
      font-size: 14px;
      border-bottom: 1px solid #e2e8f0;
    }

    th {
      text-transform: uppercase;
      font-size: 11px;
      letter-spacing: 0.08em;
      color: #475569;
      position: sticky;
      top: 0;
      background: #ffffff;
      z-index: 2;
    }

    td:first-child,
    th:first-child {
      width: 60%;
    }

    td:nth-child(2),
    th:nth-child(2) {
      width: 20%;
      text-align: center;
    }

    td:nth-child(3),
    th:nth-child(3) {
      width: 20%;
      text-align: center;
    }

    .link-icon {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      width: 16px;
      height: 16px;
      color: #94a3b8;
    }

    .link-icon svg {
      width: 100%;
      height: 100%;
      fill: currentColor;
    }

    .sr-only {
      position: absolute;
      width: 1px;
      height: 1px;
      padding: 0;
      margin: -1px;
      overflow: hidden;
      clip: rect(0, 0, 0, 0);
      border: 0;
    }

    .row-content {
      display: flex;
      align-items: center;
      gap: 10px;
    }

    .row-avatar {
      width: 28px;
      height: 28px;
      border-radius: 50%;
      object-fit: cover;
      flex-shrink: 0;
      background: #f1f5ff;
    }

    .toggle {
      background: transparent;
      border: none;
      padding: 0;
      width: 44px;
      height: 24px;
      position: relative;
      cursor: pointer;
    }

    .toggle-track {
      position: absolute;
      inset: 0;
      border-radius: 999px;
      background: #e2e8f0;
      transition: background 0.4s cubic-bezier(0.4, 0, 0.2, 1);
    }

    .toggle-knob {
      position: absolute;
      width: 16px;
      height: 16px;
      border-radius: 50%;
      background: #fff;
      top: 4px;
      left: 4px;
      box-shadow: 0 2px 6px rgba(15, 23, 42, 0.25);
      transition: transform 0.4s cubic-bezier(0.4, 0, 0.2, 1), background 0.4s cubic-bezier(0.4, 0, 0.2, 1);
    }

    .toggle.active .toggle-track {
      background: #20c646;
    }

    .toggle.active .toggle-knob {
      transform: translateX(18px);
      background: #ffffff;
    }

    .empty {
      text-align: center;
      color: #94a3b8;
      font-size: 13px;
      padding: 12px 0;
    }
  </style>
    <div>
    <h3 class="panel-title">Right Panel</h3>
    <div class="table-wrapper">
      <table>
        <thead>
          <tr>
            <th>Name</th>
            <th>URL</th>
            <th>Active</th>
          </tr>
        </thead>
        <tbody></tbody>
      </table>
    </div>
  </div>
`;

class RightPanel extends HTMLElement {
  constructor() {
    super();
    this.attachShadow({ mode: 'open' }).appendChild(rightPanelTemplate.content.cloneNode(true));
    this._data = [];
    this.handleToggleClick = this.handleToggleClick.bind(this);
    this.wheelOptions = { passive: false };
    this.handleWheel = (event) => {
      const wrapper = this.shadowRoot.querySelector('.table-wrapper');
      if (!wrapper) return;
      wrapper.scrollTop += event.deltaY;
      event.preventDefault();
      event.stopPropagation();
    };
    this._headerTitle = 'Right Panel';
    this.updateTitle();
  }

  set data(items) {
    if (!Array.isArray(items)) {
      this._data = [];
    } else {
      this._data = items;
    }
    this.render();
  }

  get data() {
    return this._data;
  }

  render() {
    const tbody = this.shadowRoot.querySelector('tbody');
    if (!this._data.length) {
      tbody.innerHTML = `
        <tr>
          <td colspan="3" class="empty">No entries yet.</td>
        </tr>
      `;
      return;
    }

    tbody.innerHTML = this._data.map((item, rowIndex) => `
        <tr>
          <td>
            <div class="row-content">
              ${item.cover ? `<img src="${item.cover}" alt="${item.name ?? 'cover'}" class="row-avatar">` : ''}
              <span>${item.name ?? '—'}</span>
            </div>
          </td>
          <td>
            <a href="${item.url ?? '#'}" target="_blank" rel="noreferrer noopener" class="link-icon" aria-label="Open document link">
              <svg xmlns="http://www.w3.org/2000/svg" fill="currentColor" viewBox="0 0 16 16" aria-hidden="true">
                <path fill-rule="evenodd" d="M8.636 3.5a.5.5 0 0 0-.5-.5H1.5A1.5 1.5 0 0 0 0 4.5v10A1.5 1.5 0 0 0 1.5 16h10a1.5 1.5 0 0 0 1.5-1.5V7.864a.5.5 0 0 0-1 0V14.5a.5.5 0 0 1-.5.5h-10a.5.5 0 0 1-.5-.5v-10a.5.5 0 0 1 .5-.5h6.636a.5.5 0 0 0 .5-.5"/>
                <path fill-rule="evenodd" d="M16 .5a.5.5 0 0 0-.5-.5h-5a.5.5 0 0 0 0 1h3.793L6.146 9.146a.5.5 0 1 0 .708.708L15 1.707V5.5a.5.5 0 0 0 1 0z"/>
              </svg>
              <span class="sr-only">Open link</span>
            </a>
          </td>
          <td>
            <button
              type="button"
              class="toggle ${item.active ? 'active' : ''}"
              data-row="${rowIndex}"
              aria-pressed="${!!item.active}"
              title="${item.active ? 'Enabled' : 'Disabled'}"
            >
              <span class="toggle-track"></span>
              <span class="toggle-knob" aria-hidden="true"></span>
              <span class="sr-only">${item.active ? 'Enabled' : 'Disabled'}</span>
            </button>
          </td>
        </tr>
    `).join('');
    this.updateTitle();
  }

  connectedCallback() {
    this.shadowRoot.addEventListener('click', this.handleToggleClick);
    this.addEventListener('wheel', this.handleWheel, this.wheelOptions);
  }

  disconnectedCallback() {
    this.shadowRoot.removeEventListener('click', this.handleToggleClick);
    this.removeEventListener('wheel', this.handleWheel, this.wheelOptions);
  }

  handleToggleClick(event) {
    const toggle = event.target.closest('button.toggle');
    if (!toggle) return;
    const rowIndex = Number(toggle.dataset.row);
    if (!Number.isFinite(rowIndex) || !this._data[rowIndex]) return;
    const entry = this._data[rowIndex];
    this._data[rowIndex] = {
      ...entry,
      active: !entry.active,
    };
    this.render();
    const updated = this._data[rowIndex];
    this.dispatchEvent(new CustomEvent('right-panel-toggle', {
      detail: { item: updated },
      bubbles: true,
      composed: true
    }));
  }

  set headerTitle(value) {
    if (typeof value !== 'string') {
      value = '';
    }
    this._headerTitle = value.trim() ? value.trim() : 'Right Panel';
    this.updateTitle();
  }

  get headerTitle() {
    return this._headerTitle;
  }

  updateTitle() {
    const titleEl = this.shadowRoot?.querySelector('.panel-title');
    if (titleEl) {
      titleEl.textContent = this._headerTitle;
    }
  }
}

customElements.define('right-panel', RightPanel);
