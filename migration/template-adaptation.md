# Template footer adaptation

Reference: [brandvm/wf-template](https://github.com/brandvm/wf-template/tree/2a1343209e9cc098d77b8d140c1b2de6494283d4), inspected at commit `2a1343209e9cc098d77b8d140c1b2de6494283d4`.

## What follows the template

- Three integration locations: head connection hints, shared on-canvas CSS/config Embed, footer JavaScript loader.
- Real CSS markup for Designer; explicit localhost mode and hosted staging selection.
- Dynamic asynchronous bundle insertion starts from the footer. This is not the old parser-inserted deferred script behavior.
- The existing TypeScript/esbuild module structure and local development server.

## Brand Vision adaptations

- Actual 1680px site scale, CSS rules and modules remain unchanged. No sample resets or pre-paint scroll lock are introduced.
- Keep the Webflow-ready boot and external Webflow dependencies rather than duplicating jQuery/GSAP.
- The static Embed link uses the pinned release. Select local/staging only in those environments; no static localhost link is published. In a Chrome fixture, the unmodified template's static links requested both staging and localhost before its inline cleanup ran on a production hostname.
- Designer local/staging CSS can be selected with a browser-only link override, documented in README. This is deliberately not automatic; it replaces rather than layers the stylesheets and requires no published localhost link.
- Both CSS and JS follow the fallback chain, with CSS selected before the next JS version. Missing Embed fallback includes production styles. Duplicate execution is guarded.
- `*.canvas.webflow.com` preview domains are recognized, with dev flags scoped to the actual frame's URL/storage.
- Keep tracked release artifacts and validation-first CI instead of force-adding and then untracking `dist/`.

## Version and verification

The stylesheet, feature JavaScript and version manifest remain byte-for-byte identical to v1.1.0. The existing tag is unchanged. Only inline integration files and documentation change on `master`.

Original migration fingerprints remain untouched. The original readable head loader was moved to `migration/original-assets-loader.js`; the verifier maps that historical path to its archive while continuing to check all source modules and production assets against the original baseline.

Validation performed:

- 26 tests: CSS/JS selection, footer-only requests, early/pending CSS completion, blocked storage, CSS timeouts, full JS fallback chain, preview domain matching, missing Embed, duplicate guards, generated snippets, existing boot and lazy Swiper behavior.
- TypeScript, production build and original source/asset fingerprints pass.
- Chrome fixtures using the actual generated snippets and production bundle pass for production, production with a dev flag, staging, localhost, preview localhost, failed local CSS, failed local and staging JS, missing Embed, and duplicate footer. Each successful case evaluates the bundle once after the footer marker, has one active stylesheet and no JavaScript errors.
- Production fixtures make no localhost/staging asset requests. Local fixtures drop hosted-only CSS rules instead of retaining additive staging styles.
- A markup-only Designer fixture displays released CSS, then successfully replaces it with local CSS through a browser-only override.

These fixture checks do not establish a live-site speed improvement. Moving CSS into the shared Embed changes its position relative to page styles; the footer changes download/init timing. Test actual Webflow staging across desktop/mobile and cold/cached loads, particularly Home hero timing, Contact form loading and Our Work. No Webflow changes or publication were made during repository preparation.
