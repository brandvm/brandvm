export function initLenis() {
  if (window.Webflow && window.Webflow.env && window.Webflow.env('editor')) return;
  if (typeof window.Lenis !== 'function') return;

  var lenis = new window.Lenis({
    duration: 1.2,
    easing: function (t: number) { return Math.min(1, 1.001 - Math.pow(2, -10 * t)); },
    direction: 'vertical',
    gestureDirection: 'vertical',
    smooth: true,
    mouseMultiplier: 1,
    smoothTouch: false,
    touchMultiplier: 2,
    infinite: false,
  });
  window.lenis = lenis;

  const { gsap, ScrollTrigger } = window;
  if (gsap && ScrollTrigger) {
    lenis.on('scroll', ScrollTrigger.update);
    gsap.ticker.add(function (time: number) {
      lenis.raf(time * 1000);
    });
    gsap.ticker.lagSmoothing(0);
  } else {
    var raf = function (time: number) {
      lenis.raf(time);
      requestAnimationFrame(raf);
    };
    requestAnimationFrame(raf);
  }
}
