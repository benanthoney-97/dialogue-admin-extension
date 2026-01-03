const sliderTemplate = document.createElement('template');
sliderTemplate.innerHTML = `
  <style>
    :host {
      display: block;
    }

    .slider-container {
      display: flex;
      align-items: center;
      gap: 12px;
      margin: 12px 0;
      font-size: 12px;
    }

    span {
      color: #475569;
    }

    input[type="range"] {
      flex: 1;
      height: 4px;
      background: #e5e7eb;
      border-radius: 999px;
      appearance: none;
      outline: none;
    }

    input[type="range"]::-webkit-slider-thumb {
      appearance: none;
      width: 16px;
      height: 16px;
      background: var(--primary, #00bfa5);
      border-radius: 50%;
      cursor: pointer;
      box-shadow: 0 2px 6px rgba(0, 0, 0, 0.15);
    }

    .value-display {
      font-weight: 600;
      font-size: 16px;
      color: var(--primary, #00bfa5);
      width: 44px;
      text-align: right;
    }
  </style>
  <div class="slider-container">
    <span>Broad</span>
    <input id="threshold" type="range" min="0.50" max="0.99" step="0.01" value="0.85">
    <span>Precise</span>
    <div class="value-display" id="thresholdVal">0.85</div>
  </div>
`;

class ConfidenceSlider extends HTMLElement {
  constructor() {
    super();
    this.handleInput = this.handleInput.bind(this);
    this.attachShadow({ mode: 'open' }).appendChild(sliderTemplate.content.cloneNode(true));
    this.rangeInput = this.shadowRoot.getElementById('threshold');
    this.valueDisplay = this.shadowRoot.getElementById('thresholdVal');
  }

  connectedCallback() {
    this.rangeInput.addEventListener('input', this.handleInput);
    this.updateDisplay();
  }

  disconnectedCallback() {
    this.rangeInput.removeEventListener('input', this.handleInput);
  }

  handleInput() {
    this.updateDisplay();
  }

  updateDisplay() {
    if (this.valueDisplay && this.rangeInput) {
      this.valueDisplay.textContent = parseFloat(this.rangeInput.value).toFixed(2);
    }
  }

  set value(newValue) {
    const parsed = parseFloat(newValue);
    if (!Number.isNaN(parsed) && this.rangeInput) {
      this.rangeInput.value = parsed.toFixed(2);
      this.updateDisplay();
    }
  }

  get value() {
    return this.rangeInput ? parseFloat(this.rangeInput.value) : undefined;
  }

  get input() {
    return this.rangeInput;
  }
}

customElements.define('confidence-slider', ConfidenceSlider);
