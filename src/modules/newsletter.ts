import type Swiper from 'swiper';
import type { SwiperOptions, SwiperEvents } from 'swiper/types';
interface SliderElement extends HTMLElement {
  _smartSwiperInstance?: Swiper;
  swiper?: Swiper;
}
interface SliderConfig {
  selector: string;
  wrapper?: string;
  navPrev?: string;
  navNext?: string;
  opts: SwiperOptions;
}

export const SmartSwiper = {
  // ---------- environment ----------
  hasIO: "IntersectionObserver" in window,
  reduceMotion: typeof window.matchMedia === "function" &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches,
  debounceT: undefined as number | undefined,
  observer: null as IntersectionObserver | null,
  pendingInits: new WeakSet<SliderElement>(),
  jsLoading: null as Promise<void> | null,
  // ---------- configuration ----------
  CONFIGS: [
  {
    selector: ".newsletter-slider.swiper",
    wrapper: ".newsletter-slider",
    opts: {
      effect: "creative",
      grabCursor: true,
      loop: true,
      loopAdditionalSlides: 2,
      centeredSlides: true,
      speed: 600,
      autoplay: { delay: 2000, disableOnInteraction: false },
      creativeEffect: {
        limitProgress: 2, // how many slides influence the effect on each side
        prev: {
          translate: ["-20%", "0%", -50], // shift LEFT, slightly back in Z
          rotate: [0, 0, -6], // tilt counter-clockwise
          opacity: 1,
          shadow: true,
          scale: 0.9,
        },
        next: {
          translate: ["20%", "0%", -50], // shift RIGHT, slightly back in Z
          rotate: [0, 0, 6], // tilt clockwise
          opacity: 1,
          shadow: true,
          scale: 0.9,
        },
      },
      watchOverflow: true,
    },
  }, ] as SliderConfig[],
  // ---------- small utils ----------
  idle(fn: () => void) {
    return "requestIdleCallback" in window ?
      window.requestIdleCallback(fn) :
      setTimeout(fn, 0);
  },
  isDisplayed(el: Element | null) {
    return !!(el && el.getClientRects().length);
  },
  // ---------- CDN loaders ----------
  ensureCSS() {
    if (document.querySelector('link[href*="swiper-bundle.min.css"]')) return;
    const link = document.createElement("link");
    link.rel = "stylesheet";
    link.href = "https://cdn.jsdelivr.net/npm/swiper@11/swiper-bundle.min.css";
    document.head.appendChild(link);
  },
  ensureJS() {
    if (window.Swiper) return Promise.resolve();
    if (this.jsLoading) return this.jsLoading;
    const existing = document.querySelector<HTMLScriptElement>(
      'script[src*="swiper-bundle.min.js"]'
    );
    const script = existing || document.createElement("script");
    const loading = new Promise<void>((resolve, reject) => {
      const cleanup = () => {
        script.removeEventListener("load", onLoad);
        script.removeEventListener("error", onError);
      };
      const onError = () => {
        cleanup();
        reject(new Error("Unable to load Swiper"));
      };
      const onLoad = () => {
        if (!window.Swiper) return onError();
        cleanup();
        resolve();
      };
      script.addEventListener("load", onLoad);
      script.addEventListener("error", onError);
      if (!existing) {
        script.src = "https://cdn.jsdelivr.net/npm/swiper@11/swiper-bundle.min.js";
        script.defer = true;
        document.body.appendChild(script);
      }
    });
    this.jsLoading = loading.catch((err) => {
      this.jsLoading = null;
      if (!existing) script.remove();
      throw err;
    });
    return this.jsLoading;
  },
  // ---------- option building ----------
  normalizeOpts(base: SwiperOptions) {
    const o: SwiperOptions = Object.assign(
      {
        touchReleaseOnEdges: true,
        simulateTouch: true,
        observer: true,
        observeParents: true,
        observeSlideChildren: true,
      },
      base || {}
    );
    if (this.reduceMotion) {
      if (o.autoplay) o.autoplay = false;
      o.speed = Math.min(o.speed || 400, 300);
    }
    return o;
  },
  resolveNav(el: SliderElement, cfg: SliderConfig) {
    const root = (cfg.wrapper && el.closest(cfg.wrapper)) || null;
    const scope = root || el.parentElement || document;
    const prev = cfg.navPrev ?
      scope.querySelector<HTMLElement>(cfg.navPrev) :
      scope.querySelector<HTMLElement>(".swiper-prev");
    const next = cfg.navNext ?
      scope.querySelector<HTMLElement>(cfg.navNext) :
      scope.querySelector<HTMLElement>(".swiper-next");
    return { scope, prev, next };
  },
  withNav(el: SliderElement, cfg: SliderConfig, opts: SwiperOptions) {
    const { prev, next } = this.resolveNav(el, cfg);
    if (prev || next) {
      opts.navigation = { prevEl: prev || null, nextEl: next || null };
    }
    return opts;
  },
  readDataOverrides(el: SliderElement, opts: SwiperOptions) {
    const over = Object.assign({}, opts);
    const { dataset } = el;
    if ("swiperLoop" in dataset) over.loop = dataset.swiperLoop === "true";
    if ("swiperSpeed" in dataset) {
      over.speed = Math.max(
        0,
        parseInt(dataset.swiperSpeed || "", 10) || over.speed || 400
      );
    }
    if ("swiperAutoplay" in dataset) {
      if (dataset.swiperAutoplay === "false") over.autoplay = false;
      else {
        const delay = Math.max(0, parseInt(dataset.swiperAutoplay || "", 10) || 0);
        over.autoplay = delay ? { delay, disableOnInteraction: true } : false;
      }
    }
    return over;
  },
  // ---------- edge nav hiding ----------
  bindEdgeNavHiding(el: SliderElement, swiper: Swiper, prevEl: HTMLElement | null, nextEl: HTMLElement | null) {
    if (!swiper || el.dataset.edgeNavBound) return;
    el.dataset.edgeNavBound = "1";
    const setHidden = (btn: HTMLElement | null, hidden: boolean) => {
      if (!btn) return;
      btn.style.display = hidden ? "none" : "";
    };
    const update = () => {
      const locked = !!swiper.isLocked;
      setHidden(prevEl, locked || !!swiper.isBeginning);
      setHidden(nextEl, locked || !!swiper.isEnd);
    };
    update();
    [
      "slideChange",
      "reachBeginning",
      "reachEnd",
      "fromEdge",
      "resize",
      "update",
      "lock",
      "unlock",
    ].forEach((evt) => {
      try {
        swiper.on(evt as keyof SwiperEvents, update);
      } catch (_) {}
    });
  },
  // ---------- lifecycle ----------
  getInstance(el: SliderElement) {
    return el._smartSwiperInstance || el.swiper || null;
  },
  repairIfNeeded(el: SliderElement) {
    const cfg = this.CONFIGS.find((c) => el.matches(c.selector));
    if (!cfg) return;
    const inst = this.getInstance(el);
    if (!inst) return;
    const { prev, next } = this.resolveNav(el, cfg);
    if (this.isDisplayed(el)) {
      try {
        inst.update();
        if (inst.navigation && typeof inst.navigation.update === "function") {
          inst.navigation.update();
        }
      } catch (_) {}
    }
    this.bindEdgeNavHiding(el, inst, prev, next);
  },
  initOne(el: SliderElement) {
    if (!el) return;
    const existing = this.getInstance(el);
    if (existing) {
      this.repairIfNeeded(el);
      return;
    }
    // Don't init while hidden (inactive Webflow tab panes)
    if (!this.isDisplayed(el)) return;
    const cfg = this.CONFIGS.find((c) => el.matches(c.selector));
    if (!cfg) return;
    const opts = this.withNav(
      el,
      cfg,
      this.normalizeOpts(this.readDataOverrides(el, cfg.opts))
    );
    const { prev, next } = this.resolveNav(el, cfg);
    el.dataset.swiperInited = "1";
    try {
      const swiper = new window.Swiper!(el, opts);
      el._smartSwiperInstance = swiper;
      this.bindEdgeNavHiding(el, swiper, prev, next);
      try {
        swiper.update();
      } catch (_) {}
    } catch (err) {
      delete el.dataset.swiperInited;
      console.error("[SmartSwiper] init failed for", el, err);
    }
  },
  scan() {
    const sels = this.CONFIGS.map((c) => c.selector).join(", ");
    if (!sels) return [];
    return Array.from(document.querySelectorAll<SliderElement>(sels));
  },
  loadAndInit(el: SliderElement) {
    if (!this.isDisplayed(el) || this.pendingInits.has(el)) return;
    this.pendingInits.add(el);
    this.ensureCSS();
    this.ensureJS()
      .then(() => {
        this.initOne(el);
        // A tab may have hidden the slider while its script was loading.
        // Keep observing until an instance was actually created.
        if (this.getInstance(el) && this.observer) this.observer.unobserve(el);
      })
      .catch((err) => console.error("[SmartSwiper] loading failed", err))
      .finally(() => this.pendingInits.delete(el));
  },
  observeAndInit(els: SliderElement[]) {
    if (!els.length) return;
    if (this.hasIO && !this.observer) {
      this.observer = new IntersectionObserver(
        (entries) => {
          entries.forEach((entry) => {
            if (entry.isIntersecting) this.loadAndInit(entry.target as SliderElement);
          });
        }, { rootMargin: "200px 0px" }
      );
    }
    els.forEach((el) => {
      if (this.getInstance(el)) {
        this.repairIfNeeded(el);
      } else if (this.observer) {
        this.observer.observe(el);
      } else {
        // Preserve functionality in browsers without IntersectionObserver.
        this.loadAndInit(el);
      }
    });
  },
  boot() {
    const els = this.scan();
    if (!els.length) return;
    // Neither Swiper asset is requested until a slider approaches the viewport.
    this.observeAndInit(els);
  },
  refresh() {
    window.clearTimeout(this.debounceT);
    this.debounceT = window.setTimeout(() => this.boot(), 80);
  },
  init() {
    const start = () => {
      this.boot();
      // Refresh after Webflow tab changes
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
      window.addEventListener("resize", () => this.refresh(), {
        passive: true,
      });
      // Keep external API name
      if (!("athleticSlider" in window)) {
        Object.defineProperty(window, "athleticSlider", {
          value: Object.freeze({ refresh: () => this.refresh() }),
          writable: false,
          configurable: false,
        });
      }
    };
    if (document.readyState === "loading") {
      document.addEventListener("DOMContentLoaded", start, { once: true });
    } else {
      start();
    }
  },
};

export function initNewsletter() { SmartSwiper.init(); }
