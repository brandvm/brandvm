import { initLenis } from './modules/lenis';
import { initNewsletter } from './modules/newsletter';
import { initFlareBorder } from './modules/flare-border';
import { initCounter } from './modules/counter';
import { initDotMap } from './modules/dot-map';
import { initReadMore } from './modules/read-more';
import { initDropdownClose } from './modules/dropdown-close';

function boot() {
  if (window.__brandvmBooted) return;
  window.__brandvmBooted = true;
  // Webflow supplies jQuery / GSAP. Do not bundle another copy.
  initLenis();
  initNewsletter();
  initFlareBorder();
  initCounter();
  initDotMap();
  initReadMore();
  initDropdownClose();
  document.documentElement.dataset.bvVersion = __BV_VERSION__;
}

// Works whether the loader completes before or after Webflow's ready event.
window.Webflow = window.Webflow || [];
window.Webflow.push(boot);
