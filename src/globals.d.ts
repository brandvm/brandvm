import type Swiper from 'swiper';

interface LenisInstance {
  raf(time: number): void;
  on(event: string, callback: () => void): void;
}

declare global {
  const __BV_VERSION__: string;
  interface Window {
    Webflow?: { push(callback: () => void): unknown; env?(mode: string): boolean };
    jQuery?: JQueryStatic;
    Lenis?: new (options: Record<string, unknown>) => LenisInstance;
    lenis?: LenisInstance;
    gsap?: { ticker: { add(callback: (time: number) => void): void; lagSmoothing(threshold: number): void } };
    ScrollTrigger?: { update(): void };
    Swiper?: typeof Swiper;
    DotMap?: {
      init: (svg: SVGSVGElement, options?: Partial<import('./modules/dot-map').DotMapOptions>) => unknown;
      boot(): void;
      parseDots(path: string): unknown[];
    };
    __brandvmBooted?: boolean;
  }
}
