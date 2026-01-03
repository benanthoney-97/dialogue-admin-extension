const sidebarTemplate = document.createElement('template');
sidebarTemplate.innerHTML = `
  <style>
    :host {
      display: flex;
      flex-direction: column;
      justify-content: space-between;
      width: 240px;
      min-height: 100vh;
      background: var(--primary, #0f172a);
      color: #fefefe;
      padding: 36px 24px;
      box-shadow: 4px 0 30px rgba(15, 23, 42, 0.45);
      box-sizing: border-box;
      transition: width 0.2s ease;
    }

    .brand-logo {
      display: block;
      width: 120px;
      margin: 0 0 12px;
    }

    .nav-list {
      list-style: none;
      padding: 0;
      margin: 24px 0;
      display: flex;
      flex-direction: column;
      gap: 8px;
    }

    .nav-link {
      color: rgba(255, 255, 255, 0.9);
      text-decoration: none;
      font-size: 15px;
      padding: 10px 0;
      border-left: 3px solid transparent;
      display: block;
      transition: color 0.2s ease, border-color 0.2s ease;
    }

    .nav-link.active,
    .nav-link:hover {
      color: #ffffff;
      border-left-color: #ffffff;
    }

    small {
      color: rgba(255, 255, 255, 0.7);
      font-size: 12px;
      margin-top: 16px;
      display: block;
    }
  </style>
    <div>
    <div class="intro">
      <img class="brand-logo" src="../../assets/694fab5082d1c37ac311541c_Untitled_design__9_-removebg-preview.png" alt="Dialogue logo">
    </div>
    <ul class="nav-list">
      <li><a class="nav-link active" data-section="home" href="#">Home</a></li>
      <li><a class="nav-link" data-section="control" href="#">Control</a></li>
      <li><a class="nav-link" data-section="connections" href="#">Platforms</a></li>
    </ul>
  </div>
  <small>Updated moments ago from live pilot telemetry.</small>
`;

class SidebarComponent extends HTMLElement {
  static get observedAttributes() {
    return ['default-section'];
  }

  constructor() {
    super();
    this.handleNavClick = this.handleNavClick.bind(this);
    this.attachShadow({ mode: 'open' }).appendChild(sidebarTemplate.content.cloneNode(true));
  }

  connectedCallback() {
    this.navLinks = Array.from(this.shadowRoot.querySelectorAll('.nav-link'));
    this.navLinks.forEach(link => link.addEventListener('click', this.handleNavClick));
    const initial = this.getAttribute('default-section') || 'home';
    this.setActive(initial);
  }

  disconnectedCallback() {
    this.navLinks && this.navLinks.forEach(link => link.removeEventListener('click', this.handleNavClick));
  }

  handleNavClick(event) {
    event.preventDefault();
    const section = event.currentTarget.dataset.section || 'overview';
    this.setActive(section);
    this.dispatchEvent(new CustomEvent('sidebar-select', {
      detail: { section },
      bubbles: true,
      composed: true
    }));
  }

  setActive(section) {
    this.navLinks.forEach(link => {
      const isSelected = link.dataset.section === section;
      link.classList.toggle('active', isSelected);
    });
  }

  attributeChangedCallback(name, oldValue, newValue) {
    if (name === 'default-section' && this.navLinks) {
      this.setActive(newValue || 'home');
    }
  }
}

customElements.define('video-sidebar', SidebarComponent);
