# Migration record

## Baseline

- Source repository: https://github.com/hamounbv/brandvm
- Source checkout: `cd6162d28b82e434c44a0a6bf62fea4d50ef4bf3`
- Existing served release: `v1.1.0`, commit `3b96e5f117b57d387a908cecaa7dff25f9015d7d`
- Destination: https://github.com/brandvm/brandvm
- Destination template baseline: `961bc777fcf20125fb0f7132ff2ea0a558b2a32b`

`baseline.json` was captured from the actual existing jsDelivr responses and checked against the source repository artifacts. `pnpm verify:migration` compares the destination build and source files with those SHA-256 fingerprints.

`published-bootstrap.js` captures the existing inline loader. For the initial v1.1.0 migration, snippet generation substitutes only delivery URLs in that exact text. This avoids even cosmetic identifier renaming caused by re-minifying the loader with different URL strings. After an intentional version bump, snippets compile the readable `webflow/assets-loader.js` normally. Both the readable loader and captured bootstrap are fingerprinted for the migration release.

## Repository adaptation

Retain the destination's TypeScript/esbuild project structure, editor configuration, default `master` branch and GitHub Actions delivery. Replace its sample runtime/CSS with the site's existing source. Add pinned build dependencies, committed release artifacts, focused regression tests, generation of asset-only snippets, and validation before staging deployment.

Do not merge generic template resets into the site stylesheet, enable its `is-loading` scroll lock, bundle duplicate Webflow dependencies, change the initializers, or relocate styles/scripts during this transfer.

## Future switch review

Use the organization addresses from `webflow/deployment.json` only after the corresponding release assets are available and validated. A domain/repository-address substitution is the intended Webflow diff. Keep the surrounding site and page code intact. No Webflow edits are included in this migration.

For rollback of the source switch, restore the former `hamounbv/brandvm@1.1.0` URLs and the former staging base. Do not restore an entire historical head block over newer metadata, tracking or schema.

Byte-for-byte asset parity establishes that the CSS/JS content and feature behavior were not changed. Network cache state and connection timing can differ at a new URL, so visual and cold-load checks are still required before switching Webflow.
