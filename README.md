# Brand Vision custom code

Shared CSS and JavaScript for [brandvm.com](https://www.brandvm.com), following [brandvm/wf-template](https://github.com/brandvm/wf-template): real CSS links in Designer, a separate environment configuration Embed, and JavaScript loading from the footer.

## Setup and development

Use Node 22.13+ and pnpm 11.25.0. In this repository:

```sh
pnpm install --frozen-lockfile
pnpm dev
```

Open the published Webflow staging site with `?bv-dev=1` to use `http://localhost:3000/` on the same computer. Saved CSS/JS changes rebuild and reload the page. Use `?bv-dev=0` to exit; the choice persists per browser origin. Production domains ignore it. Browsers may request local-network permission.

On `.webflow.io`, the bottom-left **Staging / Dev** control also switches modes.
It starts collapsed; click it to choose a mode, and press Escape or click outside
to collapse it. Switching preserves the current page, other URL parameters and
hash, then reloads. The control is hidden on production domains, in the
Editor/Designer and preview frames, and when printing.

The label describes the JavaScript bundle that actually loaded. A fallback note
identifies staging or the pinned release, and either mode can be selected to
retry. CSS still follows the existing independent selection policy. For example,
local CSS can remain active after local JavaScript falls back to staging.
The fallback bundle must also contain the control to show it; the currently
pinned v1.1.1 release predates this feature.
The bundle captures its own script URL, so the control works with the existing
footer without a Webflow snippet update. Local styling still requires the
localhost stylesheet link in the CSS Embed to be enabled.

Custom-code preview frames on `*.canvas.webflow.com` also support dev mode. The flag must be on the actual frame's URL or in that frame's localStorage; the outer Designer URL and staging storage are separate. Use published staging when preview-frame access is unavailable.

## Webflow integration

**Edit and copy from `loader.html`.** It is the single source for the integration code; no generator is needed. Copy each marked section to its own location:

| Section | Placement |
| --- | --- |
| `HEAD` | Site settings → Head code: connection hints only |
| `EMBED_CSS` | Designer Embed 1: stylesheet links only, shared near the top of every page |
| `EMBED_CONFIG` | Designer Embed 2: configuration script, immediately after Embed 1 |
| `FOOTER` | Site settings → Footer code, before `</body>`: starts the bundle download |

Keep surrounding tracking, metadata, schema, inline styles and page/component code. Do not paste the whole file into one field. Replace the previous asset integration: remove the old `bv-site-css` head link and `loadBrandVisionAssets(...)` head bootstrap if present, replace the old CSS/config Embed with the two Embeds above, and replace/add the footer loader once. Both Embeds must appear on every page using these assets.

Designer applies the two stylesheet links without running the configuration script. On published pages, the configuration sets `window.BV`, selects production or staging CSS, and removes the localhost link unless staging dev mode is enabled. The footer starts the JavaScript request without a CSS Promise or timer.

| Environment | CSS | JavaScript |
| --- | --- | --- |
| Designer editing canvas | GitHub Pages, plus localhost when available | Embed scripts do not run |
| Production | Pinned jsDelivr v1.1.1 | Pinned jsDelivr v1.1.1 |
| Webflow staging / custom-code preview | GitHub Pages | GitHub Pages |
| Staging with `?bv-dev=1` | GitHub Pages plus localhost | Localhost |

The bases are `https://cdn.jsdelivr.net/gh/brandvm/brandvm@1.1.1/dist/`, `https://brandvm.github.io/brandvm/`, and `http://localhost:3000/`.

JavaScript request failures fall back from localhost to GitHub Pages to the pinned release. These fallbacks do not switch CSS. A missing configuration Embed warns and loads production JavaScript only; it does not repair missing styles. The footer guards against duplicate execution.

The footer inserts a dynamically loaded asynchronous script. Existing feature initialization still waits for `Webflow.push`; jQuery/GSAP remain supplied by Webflow, Lenis stays optional, and Swiper remains lazy-loaded. The site's actual CSS and feature modules are retained. No template scroll lock, theme change, or icon library is added.

Each feature initializer runs in its own error boundary. A synchronous startup
error is logged with the feature name, and later features still initialize in
their original order. The boot guard still prevents duplicate initialization.
This does not catch errors in later event handlers or retry a partially started
feature.

### Local CSS in Designer

Run `pnpm dev` on the same computer and reload Designer to pick up the local stylesheet. No URL flag or DevTools override is needed for Designer CSS. When localhost is unavailable, the GitHub Pages stylesheet remains. Designer does not run the bundle's live-reload script; refresh it after CSS changes. Use published staging with `?bv-dev=1` for JavaScript and automatic reloads.

The local sheet layers over the staging sheet. Removing a rule locally can leave the staging rule visible, so inspect stylesheet sources when checking deletions. Browsers can request the static staging and localhost links on published pages before the configuration changes/removes them; this pattern does not guarantee zero extra requests or that cleanup always precedes first paint.

### Lazy videos

The bundle includes the lazy-video footer logic; no extra footer script is needed.
Opt in with `data-bv-lazy-video="true"` on a video and store its URL in `data-src`
on the video or its child `<source>` elements. Keep those URLs out of `src` until
loading is needed; `preload="none"` is also appropriate for the initial markup.
The loader starts on DOM readiness, independently of Webflow, and loads each
video once when it comes within 300px above or below the viewport. It enables
muted inline playback and shows controls if autoplay is rejected. Browsers
without IntersectionObserver load the opted-in videos immediately. It shares
`window.__bvLazyVideosStarted` with the supplied standalone snippet to avoid
duplicate initialization. Unmarked videos are left alone.

## Validation and production releases

Install the browser used by the local checks once after installing dependencies:

```sh
pnpm exec playwright install chromium
```

```sh
pnpm check       # strict TypeScript
pnpm build       # clean production build; no dev maps or live reload
pnpm test        # actual loader.html integration and feature checks
pnpm test:browser # browser checks against the current dist/ (build first)
pnpm validate    # typecheck, build, unit checks and browser checks
pnpm test:webflow # build + read-only checks using published Webflow pages
```

Browser checks run at desktop and mobile viewport sizes using the real loader
sections and built assets. All page and asset requests are intercepted locally;
the tests do not contact or modify Webflow. They cover environment selection,
JavaScript fallback, Webflow-ready startup, keyboard read-more behavior, and the
navigation/Home hero visibility fallback. Switcher checks also cover fallback
labels, keyboard/mobile use, storage failures, duplicate execution and host
restrictions. These fixtures do not replace a live site check of Webflow
interactions or page layout.

### Read-only checks against published pages

`pnpm test:webflow` checks Home, Contact, Work, Insights, Branding, About and a
case study at desktop/mobile widths. It keeps the published HTML and Webflow
scripts intact, serving the local built CSS and JS in place of the hosted asset
responses in an isolated browser. It checks the local bundle boots once, the
expected mode/control is present, site assets load and no runtime errors occur.
This tests the published integration; it does not apply unpublished `loader.html`
changes to the page.

```sh
node scripts/check-webflow.mjs / /contact # selected staging pages; build first
node scripts/check-webflow.mjs --production / # production HTML, local asset responses
node scripts/check-webflow.mjs --local /  # use the running localhost server
```

The checker blocks non-read HTTP methods and tracking/media requests, never
submits forms, and never edits or publishes Webflow or GitHub Pages. It records
runtime/visibility information and Home/failure screenshots under ignored
`test-results/webflow-*/` directories. It is a manual check, separate from CI,
because it depends on the published site and external Webflow scripts. Skipped
media, untouched form submissions and animation timing still need manual QA.
The `--local` mode reports whether the published Embed includes local CSS; it
does not enable a commented-out stylesheet link.

Stop `pnpm dev` before a release build: both commands write `dist/`. Production artifacts remain tracked. CI rebuilds and rejects drift; a passing `master` build publishes assets to GitHub Pages. It never edits or publishes Webflow.

For a new runtime release:

1. Update `package.json` and both `VER` values in `loader.html` together. The static Designer links stay on staging/localhost. Tests reject mismatched release versions.
2. Stop the dev server, run `pnpm validate`, and commit source, production `dist/` and `loader.html` changes.
3. Merge after CI passes, verify hosted staging with `?bv-dev=0`, then create a new immutable release tag on that commit.
4. Verify the pinned CDN files, apply all four sections from `loader.html` to Webflow staging, test, then publish production.

Never move a published tag or use `@latest`/branch URLs on production. Release **v1.1.1** includes the separate Designer CSS/config Embeds, footer loader and responsive Insights menu styles. Use its `loader.html` for this release. The existing **v1.1.0** assets and tag remain unchanged; that old tag contains the earlier head-loader instructions. Previous integrations and audit records remain available in Git history.

Before production, check Home, Contact, Our Work, Insights, a service page and a case study on desktop/mobile and cold/cached loads. Confirm the actual Network URLs, then check hero timing, forms, navigation, scrolling and sliders. A working fallback can conceal a failed staging asset. The Embeds' position can affect style overrides and loading; the repo changes alone do not establish a live-site speed improvement.

For rollback of an integration change, restore the previous head/Embed/footer asset sections together, preserving surrounding Webflow code. Repository work does not publish the site.

## Structure

```text
src/index.ts       module imports and Webflow-ready initialization
src/modules/       site features
src/modules/environment-switcher.ts staging-only Dev / Staging control
src/styles.css     custom stylesheet
build.mjs          esbuild production build and local server
loader.html        editable Head / CSS Embed / Config Embed / Footer integration
dist/             committed production JS, CSS and version manifest
tests/             loader and feature checks
tests/browser/     isolated desktop/mobile browser checks
playwright.config.mjs browser test configuration
scripts/check-webflow.mjs read-only checks using published page markup
.github/workflows/ validation and staging asset deployment
```

### CSS maintenance

The stylesheet's opening comment lists its five sections. Add rules beside the
related feature and preserve existing order: later declarations can win when
specificity and importance are equal. Keep Brand Vision's sizing, tokens and
component rules when adopting documentation or tooling from `wf-template`.

The navigation/Home hero fallback forces only `visibility: visible` on the
specified CTA groups and hero text while `html` has `w-mod-js` without
`w-mod-ix3`. It stops matching once IX3 initializes. It does not override
`display`, opacity or transforms, so this is a visibility fallback, not a
guarantee that an element will render when other styles hide it. It ships in
`styles.css`; production receives it only through a future pinned release.
