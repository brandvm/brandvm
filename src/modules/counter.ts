interface CountOptions {
  target: number; start: number; duration: number; decimals: number;
  separator: string; prefix: string; suffix: string; easeFn: (t: number) => number;
}

export const SmartCounter = {
  // ---------- environment ----------
  hasIO: "IntersectionObserver" in window,
  reduceMotion: typeof window.matchMedia === "function" &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches,
  debounceT: undefined as number | undefined,
  // ---------- configuration ----------
  SELECTOR: "[data-count-end]",
  THRESHOLD: 0,
  ROOT_MARGIN: "0px 0px -10% 0px",
  DEFAULT_DURATION: 2000,
  DEFAULT_EASING: "cubic",
  EASINGS: {
    quad: (t: number) => 1 - (1 - t) * (1 - t),
    cubic: (t: number) => 1 - Math.pow(1 - t, 3),
    quart: (t: number) => 1 - Math.pow(1 - t, 4),
    expo: (t: number) => (t === 1 ? 1 : 1 - Math.pow(2, -10 * t)),
  } as Record<string, (t: number) => number>,
  // ---------- small utils ----------
  isDisplayed(el: Element | null) {
    return !!(el && el.getClientRects().length);
  },
  isCounted(el: HTMLElement) {
    return el.dataset.counted === "true";
  },
  // ---------- formatting ----------
  readOptions(el: HTMLElement): CountOptions {
    const d = el.dataset;
    return {
      target: parseFloat(d.countEnd ?? d.countTarget ?? "") || 0,
      start: parseFloat(d.countStart || "") || 0,
      duration: Math.max(
        0,
        parseInt(d.countDuration || "", 10) || this.DEFAULT_DURATION
      ),
      decimals: Math.max(0, parseInt(d.countDecimals || "", 10) || 0),
      separator: d.countSeparator ?? ",",
      prefix: d.countPrefix || "",
      suffix: d.countSuffix || "",
      easeFn: this.EASINGS[d.countEase || ""] || this.EASINGS[this.DEFAULT_EASING],
    };
  },
  format(n: number, opts: CountOptions) {
    const fixed = n.toFixed(opts.decimals);
    const [int, dec] = fixed.split(".");
    const withSep = opts.separator ?
      int.replace(/\B(?=(\d{3})+(?!\d))/g, opts.separator) :
      int;
    return opts.prefix + (dec ? `${withSep}.${dec}` : withSep) + opts.suffix;
  },
  // ---------- lifecycle ----------
  animate(el: HTMLElement) {
    if (!el || this.isCounted(el)) return;
    if (!this.isDisplayed(el)) return;
    el.dataset.counted = "true";
    const opts = this.readOptions(el);
    // Reduced motion: skip the animation, show final value immediately
    if (this.reduceMotion || opts.duration === 0) {
      el.textContent = this.format(opts.target, opts);
      return;
    }
    const startTime = performance.now();
    const tick = (now: number) => {
      const t = Math.min((now - startTime) / opts.duration, 1);
      const value = opts.start + (opts.target - opts.start) * opts.easeFn(t);
      el.textContent = this.format(value, opts);
      if (t < 1) requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  },
  scan() {
    return Array.from(document.querySelectorAll<HTMLElement>(this.SELECTOR));
  },
  observeAndAnimate(els: HTMLElement[]) {
    if (!els.length) return;
    // If IO isn't supported, animate everything immediately
    if (!this.hasIO) {
      els.forEach((el) => this.animate(el));
      return;
    }
    const io = new IntersectionObserver(
      (entries, obs) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            this.animate(entry.target as HTMLElement);
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
      if (this.isCounted(el)) return;
      io.observe(el);
    });
  },
  boot() {
    const els = this.scan();
    if (!els.length) return;
    this.observeAndAnimate(els);
  },
  refresh() {
    window.clearTimeout(this.debounceT);
    this.debounceT = window.setTimeout(() => this.boot(), 80);
  },
  init() {
    const start = () => {
      this.boot();
      // Re-scan after Webflow tab changes
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
      // Handle CMS-loaded or dynamically inserted counters
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

export function initCounter() { SmartCounter.init(); }
