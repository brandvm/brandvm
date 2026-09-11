# Brand Vision custom code

The organization repository for the shared CSS and JavaScript used by [brandvm.com](https://www.brandvm.com).

This migration replaces the starter template with the existing site's actual code. The initial **v1.0.0** organization release preserves the currently served CSS and JavaScript, with only release metadata renumbered from the original repository’s v1.1.0. Moving the source must not redesign the site or change when its features initialize.

**Repository setup does not update or publish Webflow.** The site remains on its existing source until a separate, verified source switch.

## Development

Use Node 22.13 or newer and pnpm 11.25.0.

```sh
pnpm install --frozen-lockfile
pnpm dev
```

The local server binds to `127.0.0.1:3000`. The existing Webflow staging loader supports `?bv-dev=1` and `?bv-dev=0`. Production domains ignore these flags. The production build contains no live-reload code.

```sh
pnpm check             # strict TypeScript
pnpm build             # production dist/; remove stale dev outputs
pnpm snippets          # generate asset-only integration snippets
pnpm test              # runtime, loader and Designer compatibility
pnpm verify:migration  # v1.0.0 matches the source, allowing only version metadata
pnpm validate          # run all the above checks in order
```

## Structure

```text
src/index.ts                 existing Webflow-ready initialization order
src/modules/                 seven existing features
src/globals.d.ts              types for external runtime dependencies
src/styles.css               actual site CSS in its existing cascade order
dist/                        committed JS, CSS and version manifest
build.mjs                    esbuild production and local development builds
webflow/deployment.json       organization CDN and staging addresses
webflow/assets-loader.js      existing production loader, unchanged
webflow/head-assets.html      generated head link and bootstrap only
webflow/designer-css.html     generated Designer link and published cleanup
webflow/footer-assets.html    generated footer integration note
loader.html                  generated guide to the three integration locations
migration/baseline.json       original source and CDN asset fingerprints
tests/                       focused behavior and integration checks
```

The modules are Lenis initialization, newsletter Swiper, flare borders, counters, dot map, read-more, and dropdown closing. jQuery and GSAP remain supplied by Webflow. Lenis stays optional. Swiper still downloads only when a slider approaches the viewport; its package is a development dependency for types, not a bundled runtime.

## Migration boundary

The source is `hamounbv/brandvm` at commit `cd6162d28b82e434c44a0a6bf62fea4d50ef4bf3`; production currently uses its `v1.1.0` assets. The supplied `hamoun/brandvm` URL did not resolve. The source commit, release commit, downloaded asset sizes and SHA-256 hashes are recorded in `migration/baseline.json`.

The template's generic CSS, 1440px sizing defaults, resets, pre-paint scroll lock, body stylesheet switching, and alternate footer loader are not used. Those would change the existing site. The actual stylesheet retains its 1680px scale, tokens, selectors, media queries and rule order. The runtime entry point, feature implementations, public APIs, dependency handling and Webflow-ready callback remain unchanged.

The initial org build is **v1.0.0**, with the same feature code and CSS as the original repository’s v1.1.0. Only the runtime version marker and version manifest differ; this release does not fix the outstanding loading issues. Homepage animation changes and the proposed Contact-only eager HubSpot form are separate work. Page and component code remains in Webflow.

Migration verification checks the source files, the unchanged loader, and all three production artifacts. It normalizes only the runtime version assignment and version manifest before comparing against the original fingerprints; CSS must match exactly. The original `runtimeVersion` and hashes remain archived, while `migrationVersion` identifies the org’s v1.0.0 release. Intentional behavior changes must use a new runtime version and appropriate feature tests; do not overwrite the baseline or reuse the v1.0.0 tag.

## Delivery and CI

Pull requests run validation. A validated push to `master` publishes the built assets to GitHub Pages when Pages is configured to use GitHub Actions. The workflow has no Webflow publishing step, Webflow API call, or Webflow token.

| Environment after a future source switch | Assets |
| --- | --- |
| Production | `https://cdn.jsdelivr.net/gh/brandvm/brandvm@1.0.0/dist/` |
| Webflow staging | `https://brandvm.github.io/brandvm/` |
| Local development on Webflow staging | `http://localhost:3000/` |

Production artifacts stay committed. CI rebuilds them and rejects drift. Release tags therefore contain usable `dist/index.js`, `dist/styles.css` and `dist/version.json`; no force-add/untrack release cycle is needed.

## Future Webflow source switch — separate from this repository migration

See [loader.html](loader.html) and [migration/README.md](migration/README.md). Preserve the current loader and placement. The required delivery substitutions are:

```text
hamounbv/brandvm@1.1.0  -> brandvm/brandvm@1.0.0
https://hamounbv.github.io/brandvm/ -> https://brandvm.github.io/brandvm/
```

The generated head also changes its production version metadata from 1.1.0 to 1.0.0. Replace only the existing custom asset portions of the head and shared Embed. The generated snippets deliberately omit site tracking, metadata, schema, menu breakpoint styles and page-specific code, so they cannot be mistaken for full replacements of those blocks. The existing footer needs no extra script tag.

The shared Embed retains a real stylesheet link so CSS is visible in Designer. Published-page cleanup follows the current implementation: when `#bv-site-css` exists in the head, it removes the duplicate Designer link. This preserves the current published cascade and does not introduce another CSS-placement change.

Before a source switch, verify both pinned CDN assets and test Home, Contact, Our Work, Insights, a service page and a case study on staging at desktop and mobile widths. Compare cold and cached loads. Preserved feature code does not guarantee identical CDN connection/cache timing, or fix pre-existing page-load delays. Publish changes to Webflow only as a separate authorized step.

## Later releases

The initial org v1.1.0 release/tag is withdrawn so GitHub v1.1.0 can be used later. Its old jsDelivr addresses were already requested and are permanently cached. For that future release, use a new commit-pinned CDN address and update snippet URL validation accordingly; do not reuse `brandvm/brandvm@1.1.0/dist/*` or assume deleting the tag clears it. See [the migration record](migration/README.md#release-number-correction).

1. Make and test an intentional change on a branch; bump `package.json` version and the three production version/URL fields in `webflow/deployment.json` together.
2. Run `pnpm validate`; commit source, build, configuration and generated snippets.
3. Merge after CI passes; verify the staging assets and relevant site behavior.
4. Create an immutable tag `v<version>` on the validated commit. Verify its jsDelivr files before proposing the source/version change in Webflow.

Never move a published tag or use branch/`@latest` URLs in production. A source rollback swaps delivery addresses back while retaining the same surrounding Webflow custom code.
