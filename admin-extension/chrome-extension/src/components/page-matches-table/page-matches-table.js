const template = document.createElement('template');
template.innerHTML = `
  <style>
    :host {
      display: block;
      font-family: inherit;
    }

    .table-shell {
      border-radius: 16px;
      background: #ffffff;
      overflow: hidden;
      border: 1px solid #e5e7eb;
    }

    table {
      width: 100%;
      border-collapse: collapse;
    }

    thead {
      background: #f8faff;
      font-size: 11px;
      letter-spacing: 0.08em;
      color: #64748b;
      text-transform: uppercase;
    }

    th,
    td {
      padding: 12px 16px;
      border-bottom: 1px solid #e5e7eb;
      font-size: 14px;
      text-align: left;
    }

    tbody tr:last-child td {
      border-bottom: none;
    }

    .scrolling-body {
      max-height: 360px;
      overflow: auto;
    }

    a {
      color: #0f172a;
      text-decoration: underline;
    }
  </style>
  <div class="table-shell">
    <div class="scrolling-body">
      <table>
        <thead>
          <tr>
            <th>Phrase</th>
            <th>URL</th>
            <th>Confidence</th>
          </tr>
        </thead>
        <tbody></tbody>
      </table>
    </div>
  </div>
`;

class PageMatchesTable extends HTMLElement {
  constructor() {
    super();
    this.attachShadow({ mode: 'open' }).appendChild(template.content.cloneNode(true));
    this._data = [];
  }

  set data(items) {
    this._data = Array.isArray(items) ? items : [];
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
          <td colspan="3" style="text-align:center; padding: 32px 0;">No matches found.</td>
        </tr>
      `;
      return;
    }

    tbody.innerHTML = this._data.map(row => `
      <tr>
        <td>${row.phrase ?? '—'}</td>
        <td>
          ${row.url ? `<a href="${row.url}" target="_blank" rel="noreferrer noopener">${row.url}</a>` : '—'}
        </td>
        <td>${typeof row.confidence === 'number' ? row.confidence.toFixed(2) : '—'}</td>
      </tr>
    `).join('');
  }
}

customElements.define('page-matches-table', PageMatchesTable);
