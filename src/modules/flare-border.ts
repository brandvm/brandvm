export const SmartFlareBorder = {
  // ---------- environment ----------
  hasIO: "IntersectionObserver" in window,
  reduceMotion: typeof window.matchMedia === "function" &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches,
  debounceT: undefined as number | undefined,
  // ---------- configuration ----------
  SELECTOR: "[data-flare-border]",
  ACTIVE_CLASS: "is-in-view",
  THRESHOLD: 0.25,
  ROOT_MARGIN: "0px 0px -10% 0px", // fire slightly before fully in view
  // ---------- small utils ----------
  isDisplayed(el: Element | null) {
    return !!(el && el.getClientRects().length);
  },
  // ---------- lifecycle ----------
  isActivated(el: HTMLElement) {
    return el.dataset.flareActivated === "1";
  },
  activate(el: HTMLElement) {
    if (!el || this.isActivated(el)) return;
    if (!this.isDisplayed(el)) return;
    el.dataset.flareActivated = "1";
    if (this.reduceMotion) {
      // Skip the transition entirely; jump to final state
      el.classList.add(this.ACTIVE_CLASS);
      return;
    }
    // Force a frame so the browser registers the starting state
    // before the class flips — guarantees the transition plays.
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        el.classList.add(this.ACTIVE_CLASS);
      });
    });
  },
  scan() {
    return Array.from(document.querySelectorAll<HTMLElement>(this.SELECTOR));
  },
  observeAndActivate(els: HTMLElement[]) {
    if (!els.length) return;
    // If IO isn't supported, just activate everything immediately
    if (!this.hasIO) {
      els.forEach((el) => this.activate(el));
      return;
    }
    const io = new IntersectionObserver(
      (entries, obs) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            this.activate(entry.target as HTMLElement);
            obs.unobserve(entry.target as HTMLElement);
          }
        });
      },
      {
        threshold: this.THRESHOLD,
        rootMargin: this.ROOT_MARGIN,
      }
    );
    els.forEach((el) => {
      if (this.isActivated(el)) return;
      io.observe(el);
    });
  },
  boot() {
    const els = this.scan();
    if (!els.length) return;
    this.observeAndActivate(els);
  },
  refresh() {
    window.clearTimeout(this.debounceT);
    this.debounceT = window.setTimeout(() => this.boot(), 80);
  },
  init() {
    const start = () => {
      this.boot();
      // Re-scan after Webflow tab changes (cards in inactive tabs
      // aren't measurable until their pane becomes active)
      document.addEventListener(
        "click",
        (e) => {
          const link =
            e.target instanceof Element ?
            e.target.closest(".w-tab-link") :
            null;
          if (!link) return;
          setTimeout(() => this.refresh(), 60);
        },
        true
      );
      // Handle CMS-loaded or dynamically inserted cards
      window.addEventListener("resize", () => this.refresh(), {
        passive: true,
      });
    };
    if (document.readyState === "loading") {
      document.addEventListener("DOMContentLoaded", start, { once: true });
    } else {
      start();
    }
  },
};

export function initFlareBorder() { SmartFlareBorder.init(); }
