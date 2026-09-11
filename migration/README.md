# Migration record

## Baseline

- Source repository: https://github.com/hamounbv/brandvm
- Source checkout: `cd6162d28b82e434c44a0a6bf62fea4d50ef4bf3`
- Existing served release: `v1.1.0`, commit `3b96e5f117b57d387a908cecaa7dff25f9015d7d`
- Destination: https://github.com/brandvm/brandvm, initial release `v1.0.0`
- Destination template baseline: `961bc777fcf20125fb0f7132ff2ea0a558b2a32b`

`baseline.json` was captured from the actual existing jsDelivr responses and checked against the source repository artifacts. `pnpm verify:migration` compares the destination build and source files with those SHA-256 fingerprints. The original `runtimeVersion` stays 1.1.0; `migrationVersion` is 1.0.0. Only the built runtime version assignment and version manifest are normalized back to the original version before comparison. The CSS and source files must still match exactly.

`published-bootstrap.js` captures the existing inline loader. For the initial org v1.0.0 migration, snippet generation substitutes only delivery URLs and production version metadata in that exact text. This avoids even cosmetic identifier renaming caused by re-minifying the loader with different URL strings. After an intentional version bump, snippets compile the readable `webflow/assets-loader.js` normally. Both the readable loader and captured bootstrap are fingerprinted for the migration release.

## Repository adaptation

Retain the destination's TypeScript/esbuild project structure, editor configuration, default `master` branch and GitHub Actions delivery. Replace its sample runtime/CSS with the site's existing source. Add pinned build dependencies, committed release artifacts, focused regression tests, generation of asset-only snippets, and validation before staging deployment.

Do not merge generic template resets into the site stylesheet, enable its `is-loading` scroll lock, bundle duplicate Webflow dependencies, change the initializers, or relocate styles/scripts during this transfer.

## Future switch review

Use the organization addresses from `webflow/deployment.json` only after the corresponding release assets are available and validated. Delivery-address and production-version metadata substitutions are the intended Webflow diff. Keep the surrounding site and page code intact. No Webflow edits are included in this migration.

For rollback of the source switch, restore the former `hamounbv/brandvm@1.1.0` URLs and the former staging base. Do not restore an entire historical head block over newer metadata, tracking or schema.

Asset parity after normalizing the two release metadata fields establishes that the CSS and feature code were not changed. Network cache state and connection timing can differ at a new URL, so visual and cold-load checks are still required before switching Webflow.

## Release number correction

The first org release was briefly published as v1.1.0 at `8cd2ce3a373d725de57e6e62d612c517daec1a13`. It was renumbered to v1.0.0 at the owner's request before any Webflow source switch. The org v1.1.0 release and tag are withdrawn so that GitHub version can be used for later work; the original `hamounbv/brandvm` v1.1.0 remains untouched.

The old org v1.1.0 JavaScript, CSS and manifest were fetched from jsDelivr during verification. [jsDelivr permanently caches exact-version files](https://github.com/jsdelivr/jsdelivr#caching); deleting a GitHub tag does not remove those copies, and its purge API cannot update them. A future GitHub v1.1.0 release must therefore use a fresh commit-pinned CDN address, with the generated snippet URL checks updated for that address. Do not reuse the cached `brandvm/brandvm@1.1.0/dist/*` URLs for different content.
