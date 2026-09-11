# Brand Vision custom code

Shared CSS and JavaScript for [brandvm.com](https://www.brandvm.com), following [brandvm/wf-template](https://github.com/brandvm/wf-template): CSS/config in a shared Embed, JavaScript loading in the footer, and a TypeScript/esbuild development workflow.

## Setup and development

Use Node 22.13+ and pnpm 11.25.0. In this repository:

```sh
pnpm install --frozen-lockfile
pnpm dev
```

Open the published Webflow staging site with `?bv-dev=1` to use `http://localhost:3000/` on the same computer. Saved CSS/JS changes rebuild and reload the page. Use `?bv-dev=0` to exit; the choice persists per browser origin. Production domains ignore it. Browsers may request local-network permission.

Custom-code preview frames on `*.canvas.webflow.com` also support dev mode. The flag must be on the actual frame's URL or in that frame's localStorage; the outer Designer URL and staging storage are separate. Use published staging when preview-frame access is unavailable.

## Webflow integration

**Edit and copy from `loader.html`.** It is the single source for the integration code; no generator is needed. Its three marked sections go in three different places:

| Section | Placement |
| --- | --- |
| `HEAD` | Site settings → Head code: connection hints only |
| `EMBED` | One shared on-canvas Embed near the top of every page: real CSS link and environment configuration |
| `FOOTER` | Site settings → Footer code, before `</body>`: starts the bundle download |

Keep surrounding tracking, metadata, schema, inline styles and page/component code. Do not paste the whole file into one field. When replacing the earlier head-loader setup, remove its `bv-site-css` head link and `loadBrandVisionAssets(...)` bootstrap, replace the Designer stylesheet link/cleanup with `EMBED`, and add `FOOTER` once. Apply all three sections together on staging before production.

The real stylesheet link works in Designer without JavaScript. CSS selection begins in the Embed; JavaScript starts only when the footer executes. Local/staging failures advance through matching CSS and JS sources, ending at the pinned production release. Missing Embed fallback loads production assets, and duplicate execution is guarded.

| Environment | Assets |
| --- | --- |
| Production | `https://cdn.jsdelivr.net/gh/brandvm/brandvm@1.1.0/dist/` |
| Webflow staging / custom-code preview | `https://brandvm.github.io/brandvm/` |
| Explicit dev mode | `http://localhost:3000/` |

The footer inserts an asynchronous script, as the template does. It is not a parser-inserted `defer` tag. Existing feature initialization still waits for `Webflow.push`; jQuery/GSAP remain supplied by Webflow, Lenis stays optional, and Swiper remains lazy-loaded. The site's actual CSS and feature modules are retained; no generic template resets or scroll lock were added.

### Local CSS in Designer

Designer displays released CSS by default. We avoid the template's always-active localhost link because browsers can request it on production before its cleanup runs.

For a browser-only local CSS preview, run `pnpm dev`, select the canvas iframe's execution context in browser DevTools, and run:

```js
const css = document.getElementById('bv-css');
if (!css) throw new Error('Select the canvas iframe containing the shared CSS Embed.');
css.href = 'http://localhost:3000/styles.css?v=' + Date.now();
```

Rerun the assignment after saving CSS. Reloading Designer restores the released link. For hosted staging CSS instead, use `https://brandvm.github.io/brandvm/styles.css?v=` plus `Date.now()`. This only changes your browser DOM; it does not save or publish Webflow code. It replaces rather than layers stylesheets, so local rule deletions can be checked. Use staging for interactive JavaScript and automatic page reloads.

## Validation and production releases

```sh
pnpm check       # strict TypeScript
pnpm build       # clean production build; no dev maps or live reload
pnpm test        # actual loader.html integration and feature checks
pnpm validate    # typecheck, build and tests
```

Stop `pnpm dev` before a release build: both commands write `dist/`. Production artifacts remain tracked. CI rebuilds and rejects drift; a passing `master` build publishes assets to GitHub Pages. It never edits or publishes Webflow.

For a new runtime release:

1. Update `package.json`, the CSS link in `loader.html`, and both `production` configurations in that file together. Tests reject mismatched URLs or versions.
2. Stop the dev server, run `pnpm validate`, and commit source, production `dist/` and `loader.html` changes.
3. Merge after CI passes, verify hosted staging with `?bv-dev=0`, then create a new immutable release tag on that commit.
4. Verify the pinned CDN files, apply the three sections from `loader.html` to Webflow staging, test, then publish production.

Never move a published tag or use `@latest`/branch URLs on production. The existing **v1.1.0** assets and tag are unchanged. Use the current `master` copy of `loader.html`; that old tag contains the earlier head-loader instructions. Previous integrations and audit records remain available in Git history.

Before production, check Home, Contact, Our Work, Insights, a service page and a case study on desktop/mobile and cold/cached loads. Confirm the actual Network URLs, then check hero timing, forms, navigation, scrolling and sliders. A working fallback can conceal a failed staging asset. The Embed's CSS position can affect page-level style overrides; the repo changes alone do not establish a live-site speed improvement.

For rollback of an integration change, restore the previous head/Embed/footer asset sections together, preserving surrounding Webflow code. Repository work does not publish the site.

## Structure

```text
src/index.ts       module imports and Webflow-ready initialization
src/modules/       site features
src/styles.css     custom stylesheet
build.mjs          esbuild production build and local server
loader.html        editable Head / Embed / Footer integration
dist/             committed production JS, CSS and version manifest
tests/             loader and feature checks
.github/workflows/ validation and staging asset deployment
```
