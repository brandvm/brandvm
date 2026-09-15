// Capture the bundle URL during evaluation; Webflow invokes the initializer later.
// This also works with the existing footer, which does not set BV.source.
const bundleURL = document.currentScript?.getAttribute('src');

// Shadow DOM isolates this staging-only control from the site's styles.
export function initEnvironmentSwitcher() {
  const config = window.BV;
  if (!config || !/\.webflow\.io$/.test(location.hostname)) return;
  if (window.Webflow?.env?.('editor') || window.Webflow?.env?.('design')) return;
  if (document.getElementById('bv-environment')) return;

  const source = bundleURL ? new URL('.', new URL(bundleURL, location.href)).href : config.source;
  if (source) config.source = source;
  const isDev = source ? source === config.devBase : !!config.dev;
  const releaseFallback = !!source && source !== config.devBase && source !== config.stag;
  const fallback = (!!config.dev && !isDev) || releaseFallback;
  const current = isDev ? 'Dev' : 'Staging';
  const host = document.createElement('div');
  host.id = 'bv-environment';
  const root = host.attachShadow({ mode: 'open' });
  root.innerHTML = `
    <style>
      :host {
        all: initial;
        position: fixed !important;
        left: max(10px, env(safe-area-inset-left)) !important;
        bottom: max(10px, env(safe-area-inset-bottom)) !important;
        z-index: 2147483000 !important;
        display: block !important;
        pointer-events: none !important;
        color-scheme: dark;
      }
      *, *::before, *::after { box-sizing: border-box; }
      [hidden] { display: none !important; }
      .control {
        width: max-content;
        padding: 3px;
        border: 1px solid #ffffff26;
        border-radius: 11px;
        background: #1b1b1bf2;
        box-shadow: 0 2px 10px #0002;
        opacity: .65;
        pointer-events: auto;
        transition: opacity 150ms ease;
      }
      .control:hover, .control:focus-within, .control[data-expanded] { opacity: 1; }
      button {
        appearance: none;
        display: inline-flex;
        align-items: center;
        justify-content: center;
        gap: 7px;
        margin: 0;
        border: 0;
        border-radius: 7px;
        padding: 0 10px;
        height: 28px;
        background: transparent;
        color: #c5c5c5;
        font: 500 11px/1 system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
        letter-spacing: 0;
        cursor: pointer;
        touch-action: manipulation;
      }
      button:hover { background: #ffffff12; color: #fff; }
      button:focus-visible { outline: 2px solid #d9ff54; outline-offset: 1px; }
      button[aria-pressed='true'] { background: #ffffff20; color: #fff; }
      .choices { display: flex; gap: 3px; }
      .segment { min-width: 44px; height: 32px; }
      .minimize { width: 28px; height: 32px; padding: 0; }
      .dot { width: 5px; height: 5px; border-radius: 50%; background: #b5b5b5; }
      .dot[data-dev] { background: #d9ff54; }
      svg { width: 10px; height: 10px; fill: none; stroke: currentColor; stroke-width: 1.5; }
      .status {
        margin: 5px 0 0;
        padding: 7px 9px;
        border-radius: 7px;
        background: #1b1b1bf2;
        color: #ddd;
        font: 11px/1.4 system-ui, sans-serif;
        pointer-events: auto;
      }
      @media (prefers-reduced-motion: reduce) { .control { transition: none; } }
      @media print { :host { display: none !important; } }
    </style>
    <div class="control">
      <button class="launcher" type="button" aria-expanded="false" aria-controls="choices">
        <span class="dot" aria-hidden="true"></span>
        <span class="label"></span>
        <svg viewBox="0 0 12 12" aria-hidden="true"><path d="m4 2 4 4-4 4"/></svg>
      </button>
      <div class="choices" id="choices" role="group" aria-label="Code environment" hidden>
        <button class="segment" type="button" data-mode="staging" title="Use the deployed staging code">Staging</button>
        <button class="segment" type="button" data-mode="dev" title="Use your local code — run pnpm dev first">Dev</button>
        <button class="minimize" type="button" aria-label="Minimize environment switcher" title="Minimize">
          <svg viewBox="0 0 12 12" aria-hidden="true"><path d="M2 6h8"/></svg>
        </button>
      </div>
    </div>
    <p class="status" role="status" hidden>Local JavaScript unavailable · using staging</p>
  `;

  const control = root.querySelector<HTMLDivElement>('.control')!;
  const launcher = root.querySelector<HTMLButtonElement>('.launcher')!;
  const choices = root.querySelector<HTMLDivElement>('.choices')!;
  const status = root.querySelector<HTMLParagraphElement>('.status')!;
  const segments = root.querySelectorAll<HTMLButtonElement>('[data-mode]');
  root.querySelector('.label')!.textContent = current;
  root.querySelector('.dot')!.toggleAttribute('data-dev', isDev);
  launcher.setAttribute('aria-label', `Choose environment (${current})`);
  if (releaseFallback) status.textContent = 'Staging JavaScript unavailable · using release';
  launcher.title = releaseFallback ? 'Staging JavaScript could not load. Using the pinned release.'
    : fallback ? 'Local JavaScript could not load. Using staging.'
    : 'Switch between staging and local dev';

  function expand(open: boolean, focus = false) {
    launcher.hidden = open;
    choices.hidden = !open;
    status.hidden = !open || !fallback;
    control.toggleAttribute('data-expanded', open);
    launcher.setAttribute('aria-expanded', String(open));
    if (focus) {
      if (open) root.querySelector<HTMLButtonElement>('[aria-pressed="true"]')?.focus();
      else launcher.focus();
    }
  }

  segments.forEach((button) => {
    const dev = button.dataset.mode === 'dev';
    button.setAttribute('aria-pressed', String(dev === isDev));
    button.addEventListener('click', () => {
      if (dev === !!config.dev && !fallback) return;
      // Keep the loader's existing persistence/fallback behavior. The explicit
      // URL flag also works when localStorage is unavailable.
      const url = new URL(location.href);
      url.searchParams.set('bv-dev', dev ? '1' : '0');
      try { localStorage.setItem('bv-dev', dev ? '1' : '0'); } catch { /* URL is enough. */ }
      location.assign(url.href);
    });
  });
  launcher.addEventListener('click', () => expand(true, true));
  root.querySelector('.minimize')!.addEventListener('click', () => expand(false, true));
  control.addEventListener('keydown', (event) => {
    if (event.key !== 'Escape' || choices.hidden) return;
    event.preventDefault();
    event.stopPropagation();
    expand(false, true);
  });
  document.addEventListener('pointerdown', (event) => {
    if (!event.composedPath().includes(host)) expand(false);
  });
  document.body.appendChild(host);
}
