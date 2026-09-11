// Entry point. Keep this file a manifest: one import and one call per
// module, so what runs on the site is readable at a glance. Feature code
// lives in src/modules/<name>.ts and exports a single init function that
// no-ops when its selector is absent from the page.

// import { initExample } from './modules/example';

// initExample();

// Release the pre-paint scroll lock set by the head bootstrap (loader.html).
// Must stay last, and must stay unconditional — an early return above it
// leaves the page permanently locked until the snippet's 3s timeout fires.
document.documentElement.classList.remove('is-loading');
