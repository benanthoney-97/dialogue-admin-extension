import '../slider/slider.js';
import '../providers-grid/providers-grid.js';

const template = document.createElement('template');
template.innerHTML = `
  <style>
    :host {
      display: block;
      font-family: inherit;
    }

    .panel {
      border-radius: 18px;
      background: #ffffff;
      box-shadow: 0 20px 50px rgba(15, 23, 42, 0.12);
      padding: 24px;
      border: 1px solid rgba(15, 23, 42, 0.08);
      max-width: 420px;
      width: 100%;
      display: flex;
      flex-direction: column;
      gap: 16px;
    }

    .panel h2 {
      margin: 0;
      font-size: 22px;
      color: #0f172a;
    }

    .panel p {
      margin: 0;
      color: #475569;
      font-size: 14px;
    }

    button {
      border-radius: 10px;
      border: 1px solid transparent;
      background: #0f172a;
      color: #ffffff;
      padding: 10px 20px;
      font-weight: 600;
      cursor: pointer;
      transition: opacity 0.2s ease;
    }

    button:hover {
      opacity: 0.9;
    }
  </style>
    <div class="panel">
      <div>
        <h2>Control Center</h2>
        <p>Fine-tune the Video Intelligence threshold and review immediate actions.</p>
      </div>
      <confidence-slider></confidence-slider>
      <providers-grid></providers-grid>
      <div class="actions">
        <button type="button">Save Changes</button>
      </div>
    </div>
`;

class AdminPanel extends HTMLElement {
  constructor() {
    super();
    this.attachShadow({ mode: 'open' }).appendChild(template.content.cloneNode(true));
  }
}

customElements.define('admin-panel', AdminPanel);
