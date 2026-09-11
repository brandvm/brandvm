# Brand Vision custom code

Shared CSS and JavaScript for [brandvm.com](https://www.brandvm.com), using the three-part integration from [brandvm/wf-template](https://github.com/brandvm/wf-template): **head connection hints, CSS/config in a shared Embed, and JavaScript loading in the footer**.

The feature bundle and stylesheet remain the released **v1.1.0** files. The footer adaptation changes the inline Webflow integration, not those assets. The original migration and CDN fingerprints remain in `migration/`. Do not move the v1.1.0 tag.

Repository updates do not edit or publish Webflow. Apply and test the three new snippets together on staging before changing production. The older v1.1.0 tag still contains the original head-loader instructions; use the current `master` integration files below.

## Webflow integration

`loader.html` is the combined placement guide. The `webflow/` files contain the same generated snippets separately; do not paste the entire guide into one field.

| File | Placement | Purpose |
| --- | --- | --- |
| `webflow/head-assets.html` | Site settings → Head code, asset portion only | CDN preconnect; no custom bundle loader or scroll lock |
| `webflow/designer-css.html` | One shared Embed near the top of every page | Real stylesheet visible in Designer, plus environment selection |
| `webflow/footer-assets.html` | Site settings → Footer code, before `</body>` | Starts the custom JavaScript download |

When switching from the previous integration:

1. Remove the old `bv-site-css` head link and `loadBrandVisionAssets(...)` head bootstrap. Insert the new head asset snippet. Keep tracking, metadata, schema and other inline styles.
2. Replace the previous `data-bv-designer-css` link/cleanup inside the shared Embed with the complete new CSS/config snippet. Keep surrounding markup, GTM noscript and menu breakpoint styles. The Embed must occur once on each page.
3. Add the new footer asset snippet. Remove any duplicate Brand Vision bundle loader, but preserve unrelated site and page scripts.
4. Publish only to Webflow staging, then verify all affected page types before publishing production.

CSS now occupies the shared Embed's position in the document. This deliberately follows the template, but changes its order relative to page-level inline styles, so compare layouts on staging. The loader still inserts an asynchronous script, as the template does; placing it in the footer does not make it equivalent to a parser-inserted `defer` tag.

The bundle continues to initialize through `Webflow.push`, keeping Webflow-supplied jQuery/GSAP dependencies and existing module order. Lenis remains optional. Swiper downloads only when a slider approaches the viewport. Keep page and component scripts in their existing locations; this adaptation does not change HubSpot or hero animation code.

## Development

Node 22.13+ and pnpm 11.25.0:

```sh
pnpm install --frozen-lockfile
pnpm dev
```

The server serves `dist/index.js` and `dist/styles.css` from `http://localhost:3000/`, bound to this computer. On the published `.webflow.io` site, use `?bv-dev=1` for local CSS/JS and live reload; `?bv-dev=0` exits. The flag persists per browser origin. Production domains ignore it.

The same selection works on the actual `*.canvas.webflow.com` custom-code preview frame. Enable custom code in Webflow Preview. A parameter on the outer Designer URL is not automatically passed to that frame, and its localStorage is separate from staging. Test the published staging URL when full preview-frame access is unavailable. Browsers may request local-network permission.

| Environment | CSS and JS source |
| --- | --- |
| Production | `https://cdn.jsdelivr.net/gh/brandvm/brandvm@1.1.0/dist/` |
| Webflow staging / custom-code preview | `https://brandvm.github.io/brandvm/` |
| Explicit dev mode on those environments | `http://localhost:3000/` |

CSS selection begins in the Embed. No feature JavaScript is requested until the footer runs. Local/staging stylesheet failures or timeouts advance to the next source; JavaScript failures also switch CSS before trying the next bundle. The chain is localhost → staging → pinned production. Without the Embed, the footer warns and loads production CSS/JS. Duplicate footer execution does not request another bundle.

### Designer editing canvas

The real Embed stylesheet displays the released CSS even when scripts do not execute. Unlike the template, we do not include an always-active localhost stylesheet: a Chrome request test showed those static links request staging and localhost even on production before the cleanup script runs.

For a **browser-only local CSS preview**, start `pnpm dev`, select the canvas iframe's execution context in browser DevTools, and run:

```js
const css = document.getElementById('bv-css');
if (!css) throw new Error('Select the canvas iframe containing the shared CSS Embed.');
css.href = 'http://localhost:3000/styles.css?v=' + Date.now();
```

This replaces the stylesheet in your current browser DOM; it does not save an Embed change or publish anything. Rerun the assignment after saving local CSS to refresh it. Reloading Designer restores the released link. For hosted staging CSS instead, use `https://brandvm.github.io/brandvm/styles.css?v=` plus `Date.now()`.

Only one stylesheet is active, so deleting a local rule can be tested without a staging copy continuing to apply. The editing canvas does not run the feature bundle or its live-reload script; use staging for interactive JavaScript tests.

## Validation and releases

```sh
pnpm check             # strict TypeScript
pnpm build             # clean production build, no dev maps/live reload
pnpm snippets          # regenerate the three integration snippets and guide
pnpm test              # loader, initialization and feature checks
pnpm verify:migration  # verify unchanged v1.1.0 runtime assets and source
pnpm validate          # run the complete sequence
```

Stop `pnpm dev` before building a release; both commands write `dist/`. Production artifacts are tracked permanently. Commit source changes, production `dist/`, deployment configuration and regenerated snippets together. CI rebuilds and rejects drift. A passing `master` build publishes assets to GitHub Pages; it never publishes Webflow.

For a future feature release:

1. Bump `package.json` and the production version/URLs in `webflow/deployment.json` together.
2. Stop the dev server, run `pnpm validate`, commit, and merge only after CI passes.
3. Verify hosted staging with `?bv-dev=0`, then create a new immutable release tag on the validated commit.
4. Verify its pinned CDN JS/CSS before updating Webflow snippets. Test staging and then publish production.

Check Home, Contact, Our Work, Insights, a service page and a case study on desktop/mobile and cold/cached loads. Inspect actual network URLs, console errors, forms, menus, scrolling and sliders. A successful fallback can conceal a failed staging asset, so confirm the intended source was used.

Never overwrite a published tag or use `@latest`/branch URLs on production. For rollback of this integration change, restore the previous head and shared Embed asset blocks and remove the new footer loader together. Preserve surrounding Webflow code. The v1.1.0 runtime release does not need to change.

## Source and build structure

- `src/index.ts`, `src/modules/`, `src/styles.css`: actual Brand Vision feature code and CSS; no generic template resets or scroll lock were copied.
- `build.mjs`: TypeScript/esbuild bundle and development server.
- `webflow/css-config.js`, `webflow/footer-loader.js`: readable sources for the generated inline integration.
- `scripts/snippets.mjs`: generates `webflow/*.html` and `loader.html` from `webflow/deployment.json`.
- `migration/baseline.json`: fingerprints captured from the original `hamounbv/brandvm` repository and CDN assets. The user-supplied `hamoun/brandvm` address did not resolve.
- `migration/original-assets-loader.js`, `migration/published-bootstrap.js`: archived original head-loader implementation and published text, retained for verification and rollback reference.
- `migration/template-adaptation.md`: template comparison, validation and remaining live-site checks.
