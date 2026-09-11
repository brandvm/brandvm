# Brand Vision custom code

Shared CSS and JavaScript for [brandvm.com](https://www.brandvm.com), following [brandvm/wf-template](https://github.com/brandvm/wf-template): real CSS links in Designer, a separate environment configuration Embed, and JavaScript loading from the footer.

## Setup and development

Use Node 22.13+ and pnpm 11.25.0. In this repository:

```sh
pnpm install --frozen-lockfile
pnpm dev
```

Open the published Webflow staging site with `?bv-dev=1` to use `http://localhost:3000/` on the same computer. Saved CSS/JS changes rebuild and reload the page. Use `?bv-dev=0` to exit; the choice persists per browser origin. Production domains ignore it. Browsers may request local-network permission.

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
| Production | Pinned jsDelivr v1.1.0 | Pinned jsDelivr v1.1.0 |
| Webflow staging / custom-code preview | GitHub Pages | GitHub Pages |
| Staging with `?bv-dev=1` | GitHub Pages plus localhost | Localhost |

The bases are `https://cdn.jsdelivr.net/gh/brandvm/brandvm@1.1.0/dist/`, `https://brandvm.github.io/brandvm/`, and `http://localhost:3000/`.

JavaScript request failures fall back from localhost to GitHub Pages to the pinned release. These fallbacks do not switch CSS. A missing configuration Embed warns and loads production JavaScript only; it does not repair missing styles. The footer guards against duplicate execution.

The footer inserts a dynamically loaded asynchronous script. Existing feature initialization still waits for `Webflow.push`; jQuery/GSAP remain supplied by Webflow, Lenis stays optional, and Swiper remains lazy-loaded. The site's actual CSS and feature modules are retained. No template scroll lock, theme change, or icon library is added.

### Local CSS in Designer

Run `pnpm dev` on the same computer and reload Designer to pick up the local stylesheet. No URL flag or DevTools override is needed for Designer CSS. When localhost is unavailable, the GitHub Pages stylesheet remains. Designer does not run the bundle's live-reload script; refresh it after CSS changes. Use published staging with `?bv-dev=1` for JavaScript and automatic reloads.

The local sheet layers over the staging sheet. Removing a rule locally can leave the staging rule visible, so inspect stylesheet sources when checking deletions. Browsers can request the static staging and localhost links on published pages before the configuration changes/removes them; this pattern does not guarantee zero extra requests or that cleanup always precedes first paint.

## Validation and production releases

```sh
pnpm check       # strict TypeScript
pnpm build       # clean production build; no dev maps or live reload
pnpm test        # actual loader.html integration and feature checks
pnpm validate    # typecheck, build and tests
```

Stop `pnpm dev` before a release build: both commands write `dist/`. Production artifacts remain tracked. CI rebuilds and rejects drift; a passing `master` build publishes assets to GitHub Pages. It never edits or publishes Webflow.

For a new runtime release:

1. Update `package.json` and both `VER` values in `loader.html` together. The static Designer links stay on staging/localhost. Tests reject mismatched release versions.
2. Stop the dev server, run `pnpm validate`, and commit source, production `dist/` and `loader.html` changes.
3. Merge after CI passes, verify hosted staging with `?bv-dev=0`, then create a new immutable release tag on that commit.
4. Verify the pinned CDN files, apply all four sections from `loader.html` to Webflow staging, test, then publish production.

Never move a published tag or use `@latest`/branch URLs on production. The existing **v1.1.0** assets and tag are unchanged. Use the current `master` copy of `loader.html`; that old tag contains the earlier head-loader instructions. Previous integrations and audit records remain available in Git history.

Before production, check Home, Contact, Our Work, Insights, a service page and a case study on desktop/mobile and cold/cached loads. Confirm the actual Network URLs, then check hero timing, forms, navigation, scrolling and sliders. A working fallback can conceal a failed staging asset. The Embeds' position can affect style overrides and loading; the repo changes alone do not establish a live-site speed improvement.

For rollback of an integration change, restore the previous head/Embed/footer asset sections together, preserving surrounding Webflow code. Repository work does not publish the site.

## Structure

```text
src/index.ts       module imports and Webflow-ready initialization
src/modules/       site features
src/styles.css     custom stylesheet
build.mjs          esbuild production build and local server
loader.html        editable Head / CSS Embed / Config Embed / Footer integration
dist/             committed production JS, CSS and version manifest
tests/             loader and feature checks
.github/workflows/ validation and staging asset deployment
```
