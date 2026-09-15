import { initLenis } from './modules/lenis';
import { initNewsletter } from './modules/newsletter';
import { initFlareBorder } from './modules/flare-border';
import { initCounter } from './modules/counter';
import { initDotMap } from './modules/dot-map';
import { initReadMore } from './modules/read-more';
import { initDropdownClose } from './modules/dropdown-close';
import { initEnvironmentSwitcher } from './modules/environment-switcher';
import './modules/lazy-videos';

function run(name: string, initialize: () => void) {
  try {
    initialize();
  } catch (error) {
    console.error(`[bv] ${name} failed`, error);
  }
}

function boot() {
  if (window.__brandvmBooted) return;
  window.__brandvmBooted = true;
  // Webflow supplies jQuery / GSAP. Do not bundle another copy.
  run('Lenis', initLenis);
  run('Newsletter', initNewsletter);
  run('FlareBorder', initFlareBorder);
  run('Counter', initCounter);
  run('DotMap', initDotMap);
  run('ReadMore', initReadMore);
  run('DropdownClose', initDropdownClose);
  run('EnvironmentSwitcher', initEnvironmentSwitcher);
  document.documentElement.dataset.bvVersion = __BV_VERSION__;
}

// Works whether the loader completes before or after Webflow's ready event.
window.Webflow = window.Webflow || [];
window.Webflow.push(boot);
