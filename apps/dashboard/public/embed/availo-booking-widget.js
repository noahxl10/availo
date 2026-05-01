(function () {
  const MOCK_LISTING = {
    title: "Morning Kayak Tour",
    business: "Ocean Tours Co.",
    duration: "2 hours",
    basePrice: 65,
    childPrice: 45,
    dates: [7, 8, 9, 12, 14, 15, 16, 19, 22, 23],
    slots: ["8:00 AM", "9:00 AM", "11:00 AM", "2:00 PM", "4:00 PM"],
    addons: [
      { id: "wetsuit", title: "Wetsuit Rental", description: "Thermal suit and booties", price: 15 },
      { id: "photos", title: "Photo Package", description: "Guide-captured trip gallery", price: 35 },
      { id: "private", title: "Private Guide", description: "Dedicated instructor for your group", price: 75 },
    ],
  };

  const styles = `
    @import url("https://fonts.googleapis.com/css2?family=DM+Sans:opsz,wght@9..40,400;9..40,500;9..40,600;9..40,700&display=swap");

    :host {
      --av-accent: #1e8f88;
      --av-accent-hover: #177870;
      --av-accent-soft: #eef7f6;
      --av-accent-mid: #2ea69f;
      --av-accent-wash: #cceae7;
      --av-bg: #f8f8f7;
      --av-surface: #ffffff;
      --av-border: #e4e2de;
      --av-text: #1a1916;
      --av-muted: #7d7970;
      --av-subtle: #a8a49c;
      --av-neutral-100: #f1f0ee;
      --av-neutral-300: #cac7c1;
      --av-neutral-600: #5c5852;
      --av-neutral-700: #3e3b37;
      display: block;
      width: 100%;
      max-width: 400px;
      color: var(--av-text);
      font-family: "DM Sans", "Helvetica Neue", Helvetica, Arial, sans-serif;
      font-size: 15px;
      line-height: 1.4;
      text-rendering: optimizeLegibility;
      -webkit-font-smoothing: antialiased;
    }

    *, *::before, *::after {
      box-sizing: border-box;
    }

    button,
    input {
      font: inherit;
    }

    button {
      appearance: none;
    }

    .widget {
      overflow: hidden;
      width: 100%;
      max-width: 400px;
      border-radius: 20px;
      background: var(--av-surface);
      box-shadow: 0 8px 40px rgba(0,0,0,0.12);
    }

    :host([compact]) .widget,
    .widget[data-compact="true"] {
      max-width: 100%;
      border-radius: 14px;
      box-shadow: 0 4px 20px rgba(0,0,0,0.1);
    }

    .header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 16px;
      padding: 20px 24px;
      background: var(--av-text);
    }

    :host([compact]) .header,
    .widget[data-compact="true"] .header {
      padding: 16px 18px;
    }

    .title {
      color: #ffffff;
      font-size: 16px;
      font-weight: 700;
      line-height: 1.2;
    }

    :host([compact]) .title,
    .widget[data-compact="true"] .title {
      font-size: 13px;
    }

    .subtitle {
      margin-top: 2px;
      color: rgba(255,255,255,0.5);
      font-size: 11px;
      line-height: 1.4;
    }

    .dots {
      display: flex;
      flex-shrink: 0;
      gap: 4px;
    }

    .dot {
      width: 6px;
      height: 6px;
      border-radius: 999px;
      background: rgba(255,255,255,0.2);
    }

    .dot[data-active="true"] {
      background: var(--av-accent-mid);
    }

    .body {
      padding: 20px 24px;
    }

    :host([compact]) .body,
    .widget[data-compact="true"] .body {
      padding: 16px 18px;
    }

    .eyebrow {
      margin-bottom: 12px;
      color: var(--av-muted);
      font-size: 12px;
      font-weight: 600;
      letter-spacing: 0.08em;
      line-height: 1.2;
      text-transform: uppercase;
    }

    .chip-grid {
      display: flex;
      flex-wrap: wrap;
      gap: 6px;
      margin-bottom: 16px;
    }

    .chip {
      min-width: 44px;
      min-height: 44px;
      padding: 6px 12px;
      border: 1.5px solid var(--av-border);
      border-radius: 7px;
      background: var(--av-surface);
      color: var(--av-neutral-700);
      cursor: pointer;
      font-size: 12px;
      font-weight: 400;
      transition: background-color 0.1s ease, border-color 0.1s ease, color 0.1s ease, box-shadow 0.1s ease;
    }

    .chip:hover {
      border-color: var(--av-neutral-300);
      background: var(--av-bg);
    }

    .chip[data-selected="true"] {
      border-color: var(--av-accent);
      background: var(--av-accent);
      color: #ffffff;
      font-weight: 600;
    }

    .chip--time {
      padding: 7px 14px;
    }

    .chip--time[data-selected="true"] {
      background: var(--av-accent-soft);
      color: var(--av-accent-hover);
    }

    .guest-list {
      overflow: hidden;
      border: 1px solid var(--av-border);
      border-radius: 12px;
      background: var(--av-surface);
    }

    .guest-row {
      display: flex;
      align-items: center;
      gap: 14px;
      padding: 14px 18px;
      border-bottom: 1px solid var(--av-neutral-100);
    }

    .guest-row:last-child {
      border-bottom: 0;
    }

    .guest-copy {
      flex: 1;
      min-width: 0;
    }

    .guest-copy strong {
      display: block;
      color: var(--av-text);
      font-size: 13px;
      font-weight: 500;
    }

    .guest-copy span {
      display: block;
      margin-top: 1px;
      color: var(--av-subtle);
      font-size: 11px;
    }

    .stepper {
      display: flex;
      align-items: center;
      gap: 12px;
    }

    .stepper button {
      display: inline-flex;
      width: 44px;
      height: 44px;
      align-items: center;
      justify-content: center;
      border: 1.5px solid var(--av-neutral-300);
      border-radius: 999px;
      background: transparent;
      color: var(--av-neutral-600);
      cursor: pointer;
      font-size: 16px;
      line-height: 1;
    }

    .stepper button[data-plus="true"] {
      border-color: var(--av-accent);
      color: var(--av-accent);
    }

    .stepper button:disabled {
      cursor: not-allowed;
      opacity: 0.45;
    }

    .stepper span {
      min-width: 14px;
      color: var(--av-text);
      font-size: 14px;
      font-weight: 700;
      text-align: center;
    }

    .addon-list {
      display: flex;
      flex-direction: column;
      gap: 10px;
    }

    .addon {
      min-height: 64px;
      display: flex;
      align-items: center;
      gap: 14px;
      width: 100%;
      padding: 13px 16px;
      border: 1.5px solid var(--av-border);
      border-radius: 10px;
      background: var(--av-surface);
      color: var(--av-text);
      cursor: pointer;
      text-align: left;
      transition: background-color 0.15s ease, border-color 0.15s ease;
    }

    .addon:hover,
    .addon[data-selected="true"] {
      border-color: var(--av-accent-mid);
      background: var(--av-accent-soft);
    }

    .addon-icon {
      display: flex;
      width: 36px;
      height: 36px;
      align-items: center;
      justify-content: center;
      flex-shrink: 0;
      border-radius: 8px;
      background: var(--av-neutral-100);
      color: var(--av-subtle);
      font-weight: 700;
    }

    .addon[data-selected="true"] .addon-icon {
      background: var(--av-accent-wash);
      color: var(--av-accent-hover);
    }

    .addon-copy {
      flex: 1;
      min-width: 0;
    }

    .addon-copy strong,
    .addon-copy span {
      display: block;
    }

    .addon-copy strong {
      color: var(--av-text);
      font-size: 13px;
      font-weight: 600;
    }

    .addon-copy span {
      margin-top: 2px;
      color: var(--av-muted);
      font-size: 11px;
    }

    .addon-price {
      color: var(--av-neutral-600);
      font-size: 14px;
      font-weight: 700;
    }

    .addon[data-selected="true"] .addon-price {
      color: var(--av-accent);
    }

    .check {
      display: flex;
      width: 20px;
      height: 20px;
      align-items: center;
      justify-content: center;
      flex-shrink: 0;
      border: 2px solid var(--av-border);
      border-radius: 999px;
      color: #ffffff;
      font-size: 11px;
      font-weight: 700;
    }

    .addon[data-selected="true"] .check {
      border-color: var(--av-accent);
      background: var(--av-accent);
    }

    .summary {
      margin-bottom: 14px;
      padding: 12px 14px;
      border-radius: 10px;
      background: var(--av-bg);
    }

    .summary-row {
      display: flex;
      justify-content: space-between;
      gap: 12px;
      margin-bottom: 6px;
      color: var(--av-muted);
      font-size: 12px;
    }

    .summary-row:last-child {
      margin-bottom: 0;
    }

    .summary-row strong {
      color: var(--av-text);
      font-weight: 600;
      text-align: right;
    }

    .summary-row[data-total="true"] {
      margin-top: 8px;
      padding-top: 8px;
      border-top: 1px solid var(--av-border);
    }

    .summary-row[data-total="true"] strong {
      color: var(--av-accent);
      font-size: 14px;
    }

    .field {
      width: 100%;
      min-height: 44px;
      margin-bottom: 8px;
      padding: 9px 12px;
      border: 1.5px solid var(--av-border);
      border-radius: 8px;
      outline: none;
      background: var(--av-surface);
      color: var(--av-text);
      font-size: 12px;
    }

    .field::placeholder {
      color: var(--av-subtle);
    }

    .field:focus {
      border-color: var(--av-accent-mid);
      box-shadow: 0 0 0 2px var(--av-accent-soft);
    }

    .actions {
      display: flex;
      gap: 8px;
      margin-top: 16px;
    }

    .action {
      min-height: 44px;
      padding: 10px 12px;
      border-radius: 9px;
      cursor: pointer;
      font-size: 13px;
      font-weight: 600;
      line-height: 1.2;
      transition: background-color 0.15s ease, border-color 0.15s ease, color 0.15s ease, box-shadow 0.15s ease;
    }

    .action:focus-visible,
    .chip:focus-visible,
    .addon:focus-visible,
    .stepper button:focus-visible {
      outline: 2px solid var(--av-accent-mid);
      outline-offset: 2px;
    }

    .action--primary {
      flex: 2;
      border: 1.5px solid var(--av-accent);
      background: var(--av-accent);
      color: #ffffff;
    }

    .action--primary:hover {
      border-color: var(--av-accent-hover);
      background: var(--av-accent-hover);
    }

    .action--secondary {
      flex: 1;
      border: 1.5px solid var(--av-border);
      background: transparent;
      color: var(--av-neutral-600);
    }

    .action--secondary:hover {
      border-color: var(--av-neutral-300);
      background: var(--av-bg);
      color: var(--av-text);
    }

    .confirm {
      text-align: center;
    }

    .confirm-icon {
      display: flex;
      width: 48px;
      height: 48px;
      align-items: center;
      justify-content: center;
      margin: 0 auto 14px;
      border-radius: 999px;
      background: var(--av-accent-soft);
      color: var(--av-accent);
      font-size: 24px;
      font-weight: 700;
    }

    .confirm h3 {
      margin: 0 0 6px;
      color: var(--av-text);
      font-size: 17px;
      font-weight: 700;
      line-height: 1.2;
    }

    .confirm p {
      margin: 0 0 16px;
      color: var(--av-muted);
      font-size: 12px;
      line-height: 1.5;
    }

    @media (max-width: 420px) {
      :host {
        max-width: 100%;
      }

      .widget {
        border-radius: 14px;
        box-shadow: 0 4px 20px rgba(0,0,0,0.1);
      }

      .header {
        padding: 16px 18px;
      }

      .title {
        font-size: 13px;
      }

      .body {
        padding: 16px 18px;
      }

      .chip-grid {
        gap: 6px;
      }

      .chip {
        flex: 1 1 calc(33.333% - 6px);
        padding-right: 8px;
        padding-left: 8px;
      }

      .chip--time {
        flex-basis: calc(50% - 6px);
      }

      .guest-row {
        gap: 10px;
        padding: 12px 14px;
      }

      .stepper {
        gap: 8px;
      }

      .addon {
        display: grid;
        grid-template-columns: 36px minmax(0, 1fr) auto;
        gap: 10px;
        padding: 12px;
      }

      .addon-price {
        grid-column: 2;
        font-size: 13px;
      }

      .check {
        grid-column: 3;
        grid-row: 1;
      }

      .summary-row {
        gap: 8px;
      }

      .summary-row strong {
        max-width: 68%;
      }

      .actions {
        flex-direction: column;
      }

      .action {
        width: 100%;
      }
    }
  `;

  class AvailoBookingWidget extends HTMLElement {
    constructor() {
      super();
      this.attachShadow({ mode: "open" });
      this.state = {
        step: 0,
        date: 8,
        slot: "9:00 AM",
        guests: { adults: 2, children: 1 },
        addons: new Set(["wetsuit"]),
        name: "",
        email: "",
      };
    }

    connectedCallback() {
      this.render();
    }

    get compact() {
      return this.hasAttribute("compact");
    }

    get total() {
      const guests = this.state.guests.adults * MOCK_LISTING.basePrice + this.state.guests.children * MOCK_LISTING.childPrice;
      const addons = MOCK_LISTING.addons.reduce((sum, addon) => sum + (this.state.addons.has(addon.id) ? addon.price : 0), 0);
      return guests + addons;
    }

    setState(nextState) {
      this.state = { ...this.state, ...nextState };
      this.render();
    }

    updateGuest(type, direction) {
      const limits = type === "adults" ? { min: 1, max: 10 } : { min: 0, max: 8 };
      const value = this.state.guests[type] + direction;
      this.setState({
        guests: {
          ...this.state.guests,
          [type]: Math.max(limits.min, Math.min(limits.max, value)),
        },
      });
    }

    toggleAddon(id) {
      const addons = new Set(this.state.addons);
      if (addons.has(id)) {
        addons.delete(id);
      } else {
        addons.add(id);
      }
      this.setState({ addons });
    }

    bindEvents() {
      this.shadowRoot.querySelectorAll("[data-step]").forEach((button) => {
        button.addEventListener("click", () => this.setState({ step: Number(button.dataset.step) }));
      });

      this.shadowRoot.querySelectorAll("[data-date]").forEach((button) => {
        button.addEventListener("click", () => this.setState({ date: Number(button.dataset.date) }));
      });

      this.shadowRoot.querySelectorAll("[data-slot]").forEach((button) => {
        button.addEventListener("click", () => this.setState({ slot: button.dataset.slot }));
      });

      this.shadowRoot.querySelectorAll("[data-guest]").forEach((button) => {
        button.addEventListener("click", () => this.updateGuest(button.dataset.guest, Number(button.dataset.delta)));
      });

      this.shadowRoot.querySelectorAll("[data-addon]").forEach((button) => {
        button.addEventListener("click", () => this.toggleAddon(button.dataset.addon));
      });

      this.shadowRoot.querySelectorAll("[data-field]").forEach((input) => {
        input.addEventListener("input", () => {
          this.state = { ...this.state, [input.dataset.field]: input.value };
        });
      });

      const confirm = this.shadowRoot.querySelector("[data-confirm]");
      if (confirm) {
        confirm.addEventListener("click", () => this.setState({ step: 4 }));
      }
    }

    render() {
      const stepNames = ["Select Date", "Guests", "Add-ons", "Checkout", "Confirmed"];
      this.shadowRoot.innerHTML = `
        <style>${styles}</style>
        <div class="widget" data-compact="${this.compact}">
          <div class="header">
            <div>
              <div class="title">${MOCK_LISTING.title}</div>
              <div class="subtitle">${MOCK_LISTING.business} - ${MOCK_LISTING.duration} - from $${MOCK_LISTING.basePrice}</div>
            </div>
            <div class="dots" aria-label="Booking progress">
              ${stepNames.map((_, index) => `<span class="dot" data-active="${this.state.step === index}"></span>`).join("")}
            </div>
          </div>
          <div class="body">
            ${this.renderStep()}
          </div>
        </div>
      `;
      this.bindEvents();
    }

    renderStep() {
      if (this.state.step === 0) return this.renderDateStep();
      if (this.state.step === 1) return this.renderGuestsStep();
      if (this.state.step === 2) return this.renderAddonsStep();
      if (this.state.step === 3) return this.renderCheckoutStep();
      return this.renderConfirmationStep();
    }

    renderDateStep() {
      return `
        <div>
          <div class="eyebrow">Select Date</div>
          <div class="chip-grid">
            ${MOCK_LISTING.dates.map((date) => `
              <button class="chip" data-date="${date}" data-selected="${this.state.date === date}" type="button">May ${date}</button>
            `).join("")}
          </div>
          <div class="eyebrow">Time</div>
          <div class="chip-grid" style="margin-bottom:20px">
            ${MOCK_LISTING.slots.map((slot) => `
              <button class="chip chip--time" data-slot="${slot}" data-selected="${this.state.slot === slot}" type="button">${slot}</button>
            `).join("")}
          </div>
          <div class="actions">
            <button class="action action--primary" data-step="1" type="button">Next: Guests</button>
          </div>
        </div>
      `;
    }

    renderGuestsStep() {
      const rows = [
        { type: "adults", label: "Adults", sub: "Ages 13+", price: MOCK_LISTING.basePrice, min: 1, max: 10 },
        { type: "children", label: "Children", sub: "Ages 3-12", price: MOCK_LISTING.childPrice, min: 0, max: 8 },
      ];

      return `
        <div>
          <div class="eyebrow">Guests</div>
          <div class="guest-list">
            ${rows.map((row) => `
              <div class="guest-row">
                <div class="guest-copy">
                  <strong>${row.label}</strong>
                  <span>${row.sub} - $${row.price}</span>
                </div>
                <div class="stepper">
                  <button data-guest="${row.type}" data-delta="-1" ${this.state.guests[row.type] <= row.min ? "disabled" : ""} type="button">-</button>
                  <span>${this.state.guests[row.type]}</span>
                  <button data-plus="true" data-guest="${row.type}" data-delta="1" ${this.state.guests[row.type] >= row.max ? "disabled" : ""} type="button">+</button>
                </div>
              </div>
            `).join("")}
          </div>
          <div class="actions">
            <button class="action action--secondary" data-step="0" type="button">Back</button>
            <button class="action action--primary" data-step="2" type="button">Next: Add-ons</button>
          </div>
        </div>
      `;
    }

    renderAddonsStep() {
      return `
        <div>
          <div class="eyebrow">Add-ons</div>
          <div class="addon-list">
            ${MOCK_LISTING.addons.map((addon) => `
              <button class="addon" data-addon="${addon.id}" data-selected="${this.state.addons.has(addon.id)}" type="button">
                <span class="addon-icon">+</span>
                <span class="addon-copy">
                  <strong>${addon.title}</strong>
                  <span>${addon.description}</span>
                </span>
                <span class="addon-price">+$${addon.price}</span>
                <span class="check">${this.state.addons.has(addon.id) ? "✓" : ""}</span>
              </button>
            `).join("")}
          </div>
          <div class="actions">
            <button class="action action--secondary" data-step="1" type="button">Back</button>
            <button class="action action--primary" data-step="3" type="button">Next: Checkout</button>
          </div>
        </div>
      `;
    }

    renderCheckoutStep() {
      return `
        <div>
          <div class="eyebrow">Checkout</div>
          ${this.renderSummary()}
          <input class="field" data-field="name" placeholder="Full name" value="${this.escape(this.state.name)}" autocomplete="name" />
          <input class="field" data-field="email" placeholder="Email address" value="${this.escape(this.state.email)}" autocomplete="email" />
          <div class="actions">
            <button class="action action--secondary" data-step="2" type="button">Back</button>
            <button class="action action--primary" data-confirm type="button">Book Now - $${this.total}</button>
          </div>
        </div>
      `;
    }

    renderConfirmationStep() {
      return `
        <div class="confirm">
          <div class="confirm-icon">✓</div>
          <h3>Booking Confirmed</h3>
          <p>Your ${MOCK_LISTING.title} is reserved for May ${this.state.date}, 2026 at ${this.state.slot}. A confirmation email has been sent.</p>
          ${this.renderSummary()}
          <div class="actions">
            <button class="action action--primary" data-step="0" type="button">Book Another Time</button>
          </div>
        </div>
      `;
    }

    renderSummary() {
      const selectedAddons = MOCK_LISTING.addons.filter((addon) => this.state.addons.has(addon.id));
      return `
        <div class="summary">
          <div class="summary-row"><span>Date</span><strong>May ${this.state.date}, 2026</strong></div>
          <div class="summary-row"><span>Time</span><strong>${this.state.slot}</strong></div>
          <div class="summary-row"><span>Guests</span><strong>${this.state.guests.adults} adults, ${this.state.guests.children} children</strong></div>
          <div class="summary-row"><span>Add-ons</span><strong>${selectedAddons.length ? selectedAddons.map((addon) => addon.title).join(", ") : "None"}</strong></div>
          <div class="summary-row" data-total="true"><span>Total</span><strong>$${this.total}</strong></div>
        </div>
      `;
    }

    escape(value) {
      return String(value)
        .replace(/&/g, "&amp;")
        .replace(/"/g, "&quot;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;");
    }
  }

  if (!customElements.get("availo-booking-widget")) {
    customElements.define("availo-booking-widget", AvailoBookingWidget);
  }

  document.querySelectorAll("[data-availo-widget]").forEach((mount) => {
    if (mount.querySelector("availo-booking-widget")) return;
    const widget = document.createElement("availo-booking-widget");
    if (mount.dataset.compact === "true") {
      widget.setAttribute("compact", "");
    }
    mount.appendChild(widget);
  });
})();
