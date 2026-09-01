(function () {
  const DEFAULT_LISTING_ID = "lst_harbor_kayak_tour";
  const DEFAULT_LOOKAHEAD_DAYS = 7;

  const styles = `
    @import url("https://fonts.googleapis.com/css2?family=DM+Sans:opsz,wght@9..40,400;9..40,500;9..40,600;9..40,700&display=swap");

    :host {
      --av-accent: #1e8f88;
      --av-accent-hover: #177870;
      --av-accent-soft: #eef7f6;
      --av-accent-mid: #2ea69f;
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

    *, *::before, *::after { box-sizing: border-box; }
    button { appearance: none; font: inherit; }

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
    .widget[data-compact="true"] .header { padding: 16px 18px; }

    .title {
      color: #ffffff;
      font-size: 16px;
      font-weight: 700;
      line-height: 1.2;
    }

    :host([compact]) .title,
    .widget[data-compact="true"] .title { font-size: 13px; }

    .subtitle {
      margin-top: 2px;
      color: rgba(255,255,255,0.58);
      font-size: 11px;
      line-height: 1.4;
    }

    .body { padding: 20px 24px; }
    :host([compact]) .body,
    .widget[data-compact="true"] .body { padding: 16px 18px; }

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

    .chip:hover:not(:disabled) {
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

    .notice {
      margin: 0;
      padding: 12px 14px;
      border: 1px solid var(--av-border);
      border-radius: 10px;
      background: var(--av-bg);
      color: var(--av-neutral-600);
      font-size: 12px;
      line-height: 1.5;
    }

    .notice[data-tone="error"] {
      border-color: #efb4a0;
      background: #fff4ee;
      color: #8c321d;
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

    .guest-row:last-child { border-bottom: 0; }

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

    .addon-copy {
      flex: 1;
      min-width: 0;
    }

    .addon-copy strong,
    .addon-copy span { display: block; }

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

    .summary-row:last-child { margin-bottom: 0; }

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

    @media (max-width: 420px) {
      :host { max-width: 100%; }
      .widget {
        border-radius: 14px;
        box-shadow: 0 4px 20px rgba(0,0,0,0.1);
      }
      .header,
      .body { padding: 16px 18px; }
      .title { font-size: 13px; }
      .chip { flex: 1 1 calc(33.333% - 6px); }
      .chip--time { flex-basis: calc(50% - 6px); }
      .guest-row {
        gap: 10px;
        padding: 12px 14px;
      }
      .addon {
        display: grid;
        grid-template-columns: minmax(0, 1fr) auto auto;
        gap: 10px;
        padding: 12px;
      }
      .actions { flex-direction: column; }
      .action { width: 100%; }
    }
  `;

  class AvailoBookingWidget extends HTMLElement {
    constructor() {
      super();
      this.attachShadow({ mode: "open" });
      this.state = {
        step: 0,
        status: "loading",
        error: "",
        listing: null,
        dates: [],
        slots: [],
        date: "",
        slot: "",
        guests: { adults: 1, children: 0 },
        addons: new Set()
      };
    }

    connectedCallback() {
      this.render();
      void this.load();
    }

    get compact() {
      return this.hasAttribute("compact");
    }

    get listingId() {
      return this.getAttribute("listing-id") || this.getAttribute("data-listing") || DEFAULT_LISTING_ID;
    }

    get businessSlug() {
      return this.getAttribute("business-slug") || this.getAttribute("data-business-slug") || "";
    }

    get apiBaseUrl() {
      const configured = this.getAttribute("api-base-url") || scriptDataset().apiBaseUrl || "";
      if (configured) return configured.replace(/\/$/, "");
      const scriptSrc = document.currentScript?.src ? new URL(document.currentScript.src, window.location.href) : null;
      return (scriptSrc?.origin || window.location.origin).replace(/\/$/, "");
    }

    async load() {
      try {
        const payload = await this.loadWidgetPayload();
        const listing = normalizeListing(payload.listing);
        const dates = normalizeWidgetAvailability(payload.availability);
        const firstDate = dates[0];
        this.setState({
          status: "ready",
          listing,
          dates,
          slots: firstDate?.slots ?? [],
          date: firstDate?.date ?? "",
          slot: firstDate?.slots[0]?.startTime ?? "",
          guests: { adults: Math.max(listing.minGuests, 1), children: 0 }
        });
      } catch (error) {
        this.setState({ status: "error", error: messageFor(error, "Booking is unavailable right now.") });
      }
    }

    async loadWidgetPayload() {
      const params = new URLSearchParams({ days: String(DEFAULT_LOOKAHEAD_DAYS) });
      if (this.hasAttribute("listing-id") || this.hasAttribute("data-listing")) params.set("listingId", this.listingId);
      if (this.businessSlug) params.set("businessSlug", this.businessSlug);
      else params.set("listingId", this.listingId);
      return this.request(`/public/widget?${params.toString()}`);
    }

    async request(path) {
      const response = await fetch(`${this.apiBaseUrl}${path}`, { cache: "no-store" });
      if (!response.ok) throw new Error(`Availo API returned ${response.status}`);
      return response.json();
    }

    setState(nextState) {
      this.state = { ...this.state, ...nextState };
      this.render();
    }

    selectDate(date) {
      const selected = this.state.dates.find((item) => item.date === date);
      this.setState({ date, slots: selected?.slots ?? [], slot: selected?.slots[0]?.startTime ?? "" });
    }

    updateGuest(type, direction) {
      const listing = this.state.listing;
      if (!listing) return;
      const nextGuests = { ...this.state.guests, [type]: this.state.guests[type] + direction };
      const total = nextGuests.adults + nextGuests.children;
      if (nextGuests.adults < 1 || nextGuests.children < 0 || total < listing.minGuests || total > listing.maxGuests) return;
      this.setState({ guests: nextGuests });
    }

    toggleAddon(id) {
      const addons = new Set(this.state.addons);
      if (addons.has(id)) addons.delete(id);
      else addons.add(id);
      this.setState({ addons });
    }

    bindEvents() {
      this.shadowRoot.querySelectorAll("[data-step]").forEach((button) => {
        button.addEventListener("click", () => this.setState({ step: Number(button.dataset.step), error: "" }));
      });

      this.shadowRoot.querySelectorAll("[data-date]").forEach((button) => {
        button.addEventListener("click", () => this.selectDate(button.dataset.date));
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
    }

    render() {
      const listing = this.state.listing;
      this.shadowRoot.innerHTML = `
        <style>${styles}</style>
        <div class="widget" data-compact="${this.compact}">
          <div class="header">
            <div>
              <div class="title">${this.escape(listing?.title ?? "Book this experience")}</div>
              <div class="subtitle">${this.escape(listing?.business?.name ?? "Availo")} - ${this.escape(listing ? formatDuration(listing.durationMinutes) : "Availability")} - ${this.escape(listing ? `from ${money(listing.basePriceCents, listing.business.currency)}` : "loading")}</div>
            </div>
          </div>
          <div class="body">${this.renderStep()}</div>
        </div>
      `;
      this.bindEvents();
    }

    renderStep() {
      if (this.state.status === "loading") return `<p class="notice">Loading live availability.</p>`;
      if (this.state.status === "error") return `<p class="notice" data-tone="error">${this.escape(this.state.error)}</p>`;
      if (!this.state.listing) return `<p class="notice" data-tone="error">Booking is unavailable right now.</p>`;
      if (this.state.step === 0) return this.renderDateStep();
      if (this.state.step === 1) return this.renderGuestsStep();
      if (this.state.step === 2) return this.renderAddonsStep();
      return this.renderSummaryStep();
    }

    renderDateStep() {
      return `
        <div>
          <div class="eyebrow">Select Date</div>
          ${this.state.dates.length ? `
            <div class="chip-grid">
              ${this.state.dates.map((date) => `<button class="chip" data-date="${this.escape(date.date)}" data-selected="${this.state.date === date.date}" type="button">${this.escape(shortDate(date.date))}</button>`).join("")}
            </div>
            <div class="eyebrow">Time</div>
            <div class="chip-grid" style="margin-bottom:20px">
              ${this.state.slots.map((slot) => `<button class="chip chip--time" data-slot="${this.escape(slot.startTime)}" data-selected="${this.state.slot === slot.startTime}" type="button">${this.escape(slot.startTime)}</button>`).join("")}
            </div>
            <div class="actions">
              <button class="action action--primary" data-step="1" type="button">Next: Guests</button>
            </div>
          ` : `<p class="notice">No available times are published yet.</p>`}
        </div>
      `;
    }

    renderGuestsStep() {
      const listing = this.state.listing;
      const totalGuests = this.state.guests.adults + this.state.guests.children;
      const rows = [
        { type: "adults", label: "Adults", sub: "Ages 13+", price: listing.basePriceCents, min: 1 },
        { type: "children", label: "Children", sub: "Ages 3-12", price: listing.childPriceCents ?? listing.basePriceCents, min: 0 }
      ];

      return `
        <div>
          <div class="eyebrow">Guests</div>
          <div class="guest-list">
            ${rows.map((row) => `
              <div class="guest-row">
                <div class="guest-copy">
                  <strong>${row.label}</strong>
                  <span>${row.sub} - ${money(row.price, listing.business.currency)}</span>
                </div>
                <div class="stepper">
                  <button data-guest="${row.type}" data-delta="-1" ${this.state.guests[row.type] <= row.min ? "disabled" : ""} type="button">-</button>
                  <span>${this.state.guests[row.type]}</span>
                  <button data-plus="true" data-guest="${row.type}" data-delta="1" ${totalGuests >= listing.maxGuests ? "disabled" : ""} type="button">+</button>
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
      const listing = this.state.listing;
      return `
        <div>
          <div class="eyebrow">Add-ons</div>
          ${listing.addOns.length ? `
            <div class="addon-list">
              ${listing.addOns.map((addon) => `
                <button class="addon" data-addon="${this.escape(addon.id)}" data-selected="${this.state.addons.has(addon.id)}" type="button">
                  <span class="addon-copy">
                    <strong>${this.escape(addon.name)}</strong>
                    <span>${this.escape(addon.description ?? quantityLabel(addon))}</span>
                  </span>
                  <span class="addon-price">+${this.escape(money(addon.priceCents, listing.business.currency))}</span>
                  <span class="check">${this.state.addons.has(addon.id) ? "x" : ""}</span>
                </button>
              `).join("")}
            </div>
          ` : `<p class="notice">No add-ons are available for this booking.</p>`}
          <div class="actions">
            <button class="action action--secondary" data-step="1" type="button">Back</button>
            <button class="action action--primary" data-step="3" type="button">Review</button>
          </div>
        </div>
      `;
    }

    renderSummaryStep() {
      return `
        <div>
          <div class="eyebrow">Booking Summary</div>
          <div class="summary">
            <div class="summary-row"><span>Date</span><strong>${this.escape(formatDate(this.state.date))}</strong></div>
            <div class="summary-row"><span>Time</span><strong>${this.escape(this.state.slot)}</strong></div>
            <div class="summary-row"><span>Guests</span><strong>${this.state.guests.adults} adults, ${this.state.guests.children} children</strong></div>
            <div class="summary-row"><span>Add-ons</span><strong>${this.escape(this.selectedAddOnNames())}</strong></div>
            <div class="summary-row" data-total="true"><span>Estimated total</span><strong>${this.escape(this.totalLabel())}</strong></div>
          </div>
          <p class="notice">Live checkout is handled by the Availo public API after the operator enables this widget for bookings.</p>
          <div class="actions">
            <button class="action action--secondary" data-step="2" type="button">Back</button>
            <button class="action action--primary" data-step="0" type="button">Choose Another Time</button>
          </div>
        </div>
      `;
    }

    selectedAddOnNames() {
      const names = this.state.listing.addOns.filter((addon) => this.state.addons.has(addon.id)).map((addon) => addon.name);
      return names.length ? names.join(", ") : "None";
    }

    totalLabel() {
      const listing = this.state.listing;
      const guestTotal = this.state.guests.adults * listing.basePriceCents + this.state.guests.children * (listing.childPriceCents ?? listing.basePriceCents);
      const addOnTotal = listing.addOns.reduce((sum, addon) => sum + (this.state.addons.has(addon.id) ? addon.priceCents : 0), 0);
      return money(guestTotal + addOnTotal, listing.business.currency);
    }

    escape(value) {
      return String(value)
        .replace(/&/g, "&amp;")
        .replace(/"/g, "&quot;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;");
    }
  }

  function normalizeListing(payload) {
    if (!payload || typeof payload !== "object") throw new Error("Invalid listing");
    if (!payload.business || typeof payload.business !== "object") throw new Error("Invalid business");
    return {
      id: stringField(payload.id),
      title: stringField(payload.title),
      durationMinutes: numberField(payload.durationMinutes),
      basePriceCents: numberField(payload.basePriceCents),
      childPriceCents: payload.childPriceCents === null || payload.childPriceCents === undefined ? null : numberField(payload.childPriceCents),
      minGuests: numberField(payload.minGuests),
      maxGuests: numberField(payload.maxGuests),
      business: {
        name: stringField(payload.business.name),
        currency: stringField(payload.business.currency || "USD")
      },
      addOns: Array.isArray(payload.addOns) ? payload.addOns.map((addOn) => ({
        id: stringField(addOn.id),
        name: stringField(addOn.name),
        description: addOn.description === null || addOn.description === undefined ? null : stringField(addOn.description),
        priceCents: numberField(addOn.priceCents),
        minQuantity: numberField(addOn.minQuantity ?? 0),
        maxQuantity: numberField(addOn.maxQuantity ?? 1)
      })) : []
    };
  }

  function normalizeWidgetAvailability(payload) {
    if (!Array.isArray(payload)) throw new Error("Invalid availability");
    return payload.map((day) => {
      if (!day || typeof day !== "object" || !Array.isArray(day.slots)) throw new Error("Invalid availability");
      return {
        date: stringField(day.date),
        slots: day.slots
          .map((slot) => ({
            startTime: stringField(slot.startTime),
            available: booleanField(slot.available)
          }))
          .filter((slot) => slot.available)
      };
    }).filter((day) => day.slots.length > 0);
  }

  function stringField(value) {
    if (typeof value !== "string") throw new Error("Invalid API field");
    return value;
  }

  function numberField(value) {
    if (!Number.isFinite(value)) throw new Error("Invalid API field");
    return value;
  }

  function booleanField(value) {
    if (typeof value !== "boolean") throw new Error("Invalid API field");
    return value;
  }

  function money(cents, currency) {
    return new Intl.NumberFormat(undefined, { style: "currency", currency: currency || "USD" }).format(cents / 100);
  }

  function formatDuration(minutes) {
    if (minutes % 60 === 0) return `${minutes / 60} hour${minutes === 60 ? "" : "s"}`;
    return `${minutes} min`;
  }

  function shortDate(date) {
    return new Date(`${date}T12:00:00`).toLocaleDateString(undefined, { month: "short", day: "numeric" });
  }

  function formatDate(date) {
    if (!date) return "Select a date";
    return new Date(`${date}T12:00:00`).toLocaleDateString(undefined, { month: "long", day: "numeric", year: "numeric" });
  }

  function quantityLabel(addOn) {
    if (addOn.maxQuantity > 1) return `Up to ${addOn.maxQuantity}`;
    return "Optional";
  }

  function messageFor(error, fallback) {
    if (error instanceof Error && error.message.includes("429")) return "Too many booking attempts. Please try again later.";
    return fallback;
  }

  function scriptDataset() {
    return document.currentScript?.dataset ?? {};
  }

  window.AvailoBookingWidgetTestHooks = {
    normalizeListing,
    normalizeWidgetAvailability,
    shortDate,
    money
  };

  if (!customElements.get("availo-booking-widget")) {
    customElements.define("availo-booking-widget", AvailoBookingWidget);
  }

  document.querySelectorAll("[data-availo-widget]").forEach((mount) => {
    if (mount.querySelector("availo-booking-widget")) return;
    const widget = document.createElement("availo-booking-widget");
    if (mount.dataset.compact === "true") widget.setAttribute("compact", "");
    if (mount.dataset.apiBaseUrl) widget.setAttribute("api-base-url", mount.dataset.apiBaseUrl);
    if (mount.dataset.listingId) widget.setAttribute("listing-id", mount.dataset.listingId);
    if (mount.dataset.businessSlug) widget.setAttribute("business-slug", mount.dataset.businessSlug);
    mount.appendChild(widget);
  });
})();
