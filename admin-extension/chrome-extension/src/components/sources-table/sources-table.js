const tableTemplate = document.createElement('template');
tableTemplate.innerHTML = `
  <style>
    :host {
      display: block;
      font-family: inherit;
    }

    .table-wrapper {
      overflow-x: auto;
      border-radius: 12px;
      background: #ffffff;
    }

    table {
      width: 100%;
      border-collapse: collapse;
      min-width: 480px;
    }

    thead {
      background: #f8faff;
      font-size: 11px;
      letter-spacing: 0.05em;
      color: #7a84bf;
    }

    th,
    td {
      padding: 14px 16px;
      text-align: left;
      border-bottom: 1px solid #f0f3f7;
      font-size: 14px;
    }

    tbody tr:last-child td {
      border-bottom: none;
    }

    td:first-child {
      font-weight: 600;
    }

    td a {
      color: inherit;
      text-decoration: underline;
    }

    .platform-logo {
      width: 40px;
      height: 40px;
      object-fit: contain;
      border-radius: 50%;
    }

    tbody tr {
      cursor: pointer;
    }

    .empty-row td {
      text-align: center;
      font-size: 14px;
      color: #7a84bf;
      padding: 34px 0;
    }
  </style>
  <div class="table-wrapper">
    <table>
      <thead>
        <tr>
          <th>Name</th>
          <th>URL</th>
          <th>Items</th>
          <th>Connected On</th>
        </tr>
      </thead>
      <tbody></tbody>
    </table>
  </div>
`;

class SourcesTable extends HTMLElement {
  constructor() {
    super();
    this.attachShadow({ mode: 'open' }).appendChild(tableTemplate.content.cloneNode(true));
    this._data = [];
    this.handleRowClick = this.handleRowClick.bind(this);
  }

  connectedCallback() {
    this.shadowRoot.addEventListener('click', this.handleRowClick);
    this.render();
  }

  disconnectedCallback() {
    this.shadowRoot.removeEventListener('click', this.handleRowClick);
  }

  set data(newData) {
    this._data = Array.isArray(newData) ? newData : [];
    this.render();
  }

  get data() {
    return this._data;
  }

  render() {
    const tbody = this.shadowRoot.querySelector('tbody');
    if (!this._data.length) {
      tbody.innerHTML = `
        <tr class="empty-row">
          <td colspan="4">No platforms connected yet.</td>
        </tr>
      `;
      return;
    }

    tbody.innerHTML = this._data.map((source, index) => `
      <tr data-index="${index}">
        <td>
          ${source.platform_logo
            ? `<img src="${source.platform_logo}" alt="${source.name}" class="platform-logo">`
            : source.name}
        </td>
        <td><a href="${source.url}" target="_blank" rel="noreferrer noopener">${source.url}</a></td>
        <td>${source.items ?? '—'}</td>
        <td>${source.connected_on_display ?? source.connected_on ?? '—'}</td>
      </tr>
    `).join('');
  }

  handleRowClick(event) {
    const row = event.target.closest('tr');
    if (!row || row.matches('.empty-row')) return;
    const idx = Number(row.dataset.index);
    const selected = this._data[idx];
    if (selected) {
      this.dispatchEvent(new CustomEvent('sources-row-select', {
        detail: { item: selected },
        bubbles: true,
        composed: true
      }));
    }
  }
}

customElements.define('sources-table', SourcesTable);
