import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import vm from "node:vm";
import { describe, expect, it } from "vitest";

function loadWidget({ mounts = [] } = {}) {
  const created = [];
  class HTMLElementStub {}
  const context = {
    HTMLElement: HTMLElementStub,
    Intl,
    URL,
    window: {
      location: { href: "http://dashboard.test/widget-host.html", origin: "http://dashboard.test" }
    },
    document: {
      currentScript: { src: "http://dashboard.test/embed/availo-booking-widget.js", dataset: {} },
      createElement(tagName) {
        const element = {
          attributes: new Map(),
          tagName,
          setAttribute(name, value) {
            this.attributes.set(name, value);
          }
        };
        created.push(element);
        return element;
      },
      querySelectorAll(selector) {
        return selector === "[data-availo-widget]" ? mounts : [];
      }
    },
    customElements: {
      registry: new Map(),
      define(name, value) {
        this.registry.set(name, value);
      },
      get(name) {
        return this.registry.get(name);
      }
    }
  };
  context.window.AvailoBookingWidgetTestHooks = undefined;
  vm.createContext(context);
  vm.runInContext(readFileSync(resolve("public/embed/availo-booking-widget.js"), "utf8"), context);
  return { context, created };
}

describe("availo booking widget", () => {
  it("normalizes public listing and availability payloads without tenant-private fields", () => {
    const { context } = loadWidget();
    const hooks = context.window.AvailoBookingWidgetTestHooks;

    const listing = hooks.normalizeListing({
      id: "lst_test",
      businessId: "biz_private",
      title: "Harbor Kayak Tour",
      durationMinutes: 60,
      basePriceCents: 6500,
      childPriceCents: null,
      minGuests: 1,
      maxGuests: 12,
      business: { name: "Sample Tours Co.", currency: "USD", taxRateBps: 850 },
      addOns: [{ id: "add_dry_bag", name: "Dry Bag", description: "Waterproof rental", priceCents: 800 }]
    });
    const availability = hooks.normalizeWidgetAvailability([
      { date: "2026-05-05", slots: [{ startTime: "9:30 AM", available: true, internalCapacity: 12 }] },
      { date: "2026-05-06", slots: [{ startTime: "11:00 AM", available: false }] }
    ]);

    expect(listing).toEqual({
      id: "lst_test",
      title: "Harbor Kayak Tour",
      durationMinutes: 60,
      basePriceCents: 6500,
      childPriceCents: null,
      minGuests: 1,
      maxGuests: 12,
      business: { name: "Sample Tours Co.", currency: "USD" },
      addOns: [{ id: "add_dry_bag", name: "Dry Bag", description: "Waterproof rental", priceCents: 800, minQuantity: 0, maxQuantity: 1 }]
    });
    expect(JSON.stringify(listing)).not.toContain("businessId");
    expect(JSON.stringify(listing)).not.toContain("taxRateBps");
    expect(availability).toEqual([{ date: "2026-05-05", slots: [{ startTime: "9:30 AM", available: true }] }]);
  });

  it("rejects malformed API payloads instead of rendering stale mock data", () => {
    const { context } = loadWidget();
    const hooks = context.window.AvailoBookingWidgetTestHooks;

    expect(() => hooks.normalizeListing({ id: "lst_test" })).toThrow("Invalid business");
    expect(() => hooks.normalizeWidgetAvailability([{ date: "2026-05-05", slots: [{ startTime: 930, available: true }] }])).toThrow("Invalid API field");
  });

  it("mounts configured attributes from host data attributes", () => {
    const mount = {
      dataset: {
        compact: "true",
        apiBaseUrl: "https://api.availo.test",
        businessSlug: "sample-tours",
        listingId: "lst_harbor_kayak_tour"
      },
      querySelector() {
        return null;
      },
      appendChild(child) {
        this.child = child;
      }
    };
    const { created } = loadWidget({ mounts: [mount] });

    expect(created).toHaveLength(1);
    expect(mount.child).toBe(created[0]);
    expect(created[0].attributes.get("compact")).toBe("");
    expect(created[0].attributes.get("api-base-url")).toBe("https://api.availo.test");
    expect(created[0].attributes.get("business-slug")).toBe("sample-tours");
    expect(created[0].attributes.get("listing-id")).toBe("lst_harbor_kayak_tour");
  });
});
