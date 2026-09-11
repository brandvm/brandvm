# Migration record

## Baseline

- Source repository: https://github.com/hamounbv/brandvm
- Source checkout: `cd6162d28b82e434c44a0a6bf62fea4d50ef4bf3`
- Existing served release: `v1.1.0`, commit `3b96e5f117b57d387a908cecaa7dff25f9015d7d`
- Destination: https://github.com/brandvm/brandvm
- Destination template baseline: `961bc777fcf20125fb0f7132ff2ea0a558b2a32b`

`baseline.json` was captured from the actual existing jsDelivr responses and checked against the source repository artifacts. `pnpm verify:migration` compares the destination build and source files with those SHA-256 fingerprints. The historical readable loader is now archived at `migration/original-assets-loader.js`; its fingerprint is verified there.

`published-bootstrap.js` captures the existing inline loader. For the initial repository-only v1.1.0 migration, snippet generation substituted only delivery URLs in that exact text. This avoids even cosmetic identifier renaming caused by re-minifying the loader with different URL strings. The subsequent template adaptation generates CSS/config and footer snippets from `webflow/css-config.js` and `webflow/footer-loader.js`. Both original loader snapshots remain fingerprinted as historical evidence; the new inline integration is covered by loader tests.

## Repository adaptation

Retain the destination's TypeScript/esbuild project structure, editor configuration, default `master` branch and GitHub Actions delivery. Replace its sample runtime/CSS with the site's existing source. Add pinned build dependencies, committed release artifacts, focused regression tests, generation of asset-only snippets, and validation before staging deployment.

Do not merge generic template resets into the site stylesheet, enable its `is-loading` scroll lock, bundle duplicate Webflow dependencies, change the initializers, or relocate styles/scripts during this transfer.

## Current integration and future switch review

The current integration follows the template’s CSS Embed + footer loader structure. Read `loader.html`, the root README and [template-adaptation.md](template-adaptation.md). The original URL-only head-loader proposal is superseded; do not apply it alongside the new footer.

Apply all three asset snippets together on Webflow staging. Preserve surrounding site/page code. No Webflow edits are included in this repo work. The v1.1.0 feature bundle, CSS and manifest are unchanged, while inline loader placement and stylesheet order deliberately change.

For rollback, restore the former head asset link/bootstrap and Designer link/cleanup, and remove the new footer loader together. Retain the former source addresses or another verified pinned release. Do not restore an entire historical head block over newer tracking, metadata or schema.

Asset parity establishes that feature code and CSS content were preserved; it does not establish identical loading or cascade behavior. Real staging layout, interaction and cold-load checks are required before production.
