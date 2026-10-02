# Gotchas

A running log of things that cost time on this project. Agents read it at
the start of every session and add to it when they hit something new (see
the Session protocol in `AGENTS.md`). Never delete an entry — update its
`Status` instead.

Entries tagged `Scope: template-candidate` are harvested across all client
repos to improve `brandvm/wf-template`.

## Entry format

```md
### YYYY-MM-DD · Short title
- Area: designer | css | loader | release | mcp | ci | js | perf
- Scope: project | template-candidate
- Symptom: what was observed
- Cause: why it happened
- Fix: what was done, or the workaround
- Status: open | fixed <sha> | upstreamed wf-template <sha>
- Found by: claude | codex | human
```

## This project

<!-- Add new entries here, newest first. -->

### 2026-09-15 · Nav and Home hero stay hidden when IX3 does not start
- Area: css
- Scope: template-candidate
- Symptom: CTA groups and hero text authored hidden for an IX3 entrance can
  stay invisible if IX3 never initialises.
- Cause: the initial hidden state lives in Webflow; nothing reveals it when
  `html` has `w-mod-js` but never gets `w-mod-ix3`.
- Fix: a visibility-only fallback in `styles.css` that matches
  `html.w-mod-js:not(.w-mod-ix3)` and stops once IX3 runs. It does not
  override display, opacity or transforms (204150e, README "CSS
  maintenance").
- Status: fixed 204150e (shipped in v1.1.2)
- Found by: codex

### 2026-09-15 · Finsweet `fs-autovideo` must go when the bundle controls video
- Area: loader
- Scope: project
- Symptom: Two video controllers compete for the same `<video>` elements.
- Cause: the v2 lazy-video controller in the bundle self-starts, while the
  Finsweet Attributes script tag in Webflow still carried `fs-autovideo`.
- Fix: remove `fs-autovideo` from that script tag in the same Webflow
  publication as v1.1.2, keeping `fs-list` and `fs-socialshare` (e51933d,
  3f8db45, `loader.html` header). A Webflow-side change; a push does not do
  it.
- Status: documented
- Found by: codex

### 2026-09-15 · `pnpm dev` and a release build both write `dist/`
- Area: release
- Scope: template-candidate
- Symptom: Committed `dist/` contains dev output or drifts from a clean
  build; CI's `git diff --exit-code -- dist` fails.
- Cause: with `dist/` tracked permanently, the dev server's writes land in
  the same files as the production build.
- Fix: stop `pnpm dev` before `pnpm validate` / a release build (README
  "Validation and production releases", 204150e).
- Status: documented
- Found by: codex

### 2026-09-11 · Custom-code preview frames keep their own dev flag
- Area: loader
- Scope: template-candidate
- Symptom: `?bv-dev=1` on the Designer URL or the staging site does not put
  the custom-code preview into dev mode.
- Cause: previews run on `*.canvas.webflow.com`, a separate origin with its
  own URL and localStorage.
- Fix: the config Embed treats `*.canvas.webflow.com` as staging; set the
  flag on the frame's own URL or storage, or use published staging (7f1fc06,
  README "Setup and development").
- Status: documented
- Found by: codex

### 2026-09-11 · Insights menu rules duplicated in a Webflow Embed
- Area: designer
- Scope: project
- Symptom: Responsive rules hiding `.mega-menu-insights-item` (last item ≤
  991px, third ≤ 767px) existed only in a page Embed.
- Cause: site CSS had been added in Webflow outside the bundle.
- Fix: rules copied into `src/styles.css` (1fddcde, PR #6) and shipped in
  v1.1.1; the original Embed was left in place until release verification.
  Remove it once confirmed, or one copy will drift.
- Status: open (check whether the Webflow Embed was removed)
- Found by: codex

### 2026-09-11 · Template defaults would have changed a live site
- Area: loader
- Scope: template-candidate
- Symptom: Adopting `wf-template` on an existing site would change its look
  and startup: starter CSS, the pre-paint scroll lock, a theme and an icon
  library.
- Cause: the template assumes a greenfield site.
- Fix: migration kept the site's real CSS and modules with byte-identical
  v1.1.0 assets (8cd2ce3, PR #1); the template's scroll lock, theme and icon
  library were deliberately not added (README "Webflow integration").
- Status: documented
- Found by: codex

### 2026-09-11 · Static stylesheet links are requested on production
- Area: loader
- Scope: template-candidate
- Symptom: A Chrome fixture showed published production pages requesting
  the staging and localhost stylesheets before cleanup.
- Cause: the template's two unconditional `<link>`s in the canvas Embed;
  the config script runs after the browser starts the requests.
- Fix: PR #3 (7f1fc06) selected preview CSS conditionally; PR #5 (328298f)
  returned to static links in a CSS-only Embed so the Designer shows real
  CSS, accepting the extra requests. README states the trade-off.
- Status: open (accepted trade-off)
- Found by: codex

## Known from previous projects

Inherited from `wf-template`. Found across earlier client repos; listed so
they are not rediscovered. Status refers to the template.

### 2026-10-02 · Neutralizers in §03 override Designer styles
- Area: css
- Scope: template-candidate
- Symptom: A style changed in the Designer has no effect on the page.
- Cause: `src/styles.css` loads after `webflow.css`, so the §03 `.w-*` rules
  win same-specificity ties by source order. `.w-layout-blockcontainer
  { max-width }` silently overrode Designer container caps (threestars
  b5f122c); the `.w-dropdown-toggle` reset broke Webflow's chevron spacing
  (reformdd 8c65a5c).
- Fix: reformdd removed ten neutralizers so "Webflow's own defaults now stand
  unopposed" (c2e5f4b). Delete a neutralizer the moment it fights the
  Designer.
- Status: open
- Found by: human

### 2026-10-02 · Root font-size scale drifts from Designer tokens
- Area: css
- Scope: template-candidate
- Symptom: Designer variables named for px values ("Max Width - 1280px")
  render at different sizes; the scale is retuned again and again.
- Cause: The §01 fluid scale sets `:root` font-size, so every rem/em value
  coming out of the Designer scales with it. reformdd retuned it seven times
  (1680 → 1440 → 1680 → clamp → revert → 1920 → 1440); threestars found em
  layout tokens rendering 6.25% short.
- Fix: none general. Agree the scale with the designer before building, or
  drop it and let Webflow variables own sizing.
- Status: open
- Found by: human

### 2026-10-02 · Renaming a Webflow variable silently breaks repo CSS
- Area: css
- Scope: template-candidate
- Symptom: A container cap or token-driven value quietly stops applying.
- Cause: Container/Max Width was renamed to Section/Max Width in Webflow.
  Webflow rewrites its own references but cannot reach this bundle, so
  `var(--_layout---container--max-width, none)` fell back to `none`
  (reformdd 1ca59f6).
- Fix: avoid referencing Webflow variable names in repo CSS; if one is
  needed, log it here so renames get checked.
- Status: open
- Found by: human

### 2026-10-02 · Removing a rule locally does not remove it on the canvas
- Area: designer
- Scope: template-candidate
- Symptom: A deleted CSS rule still applies in the Designer while `pnpm dev`
  runs.
- Cause: The canvas never runs scripts, so both the staging and the
  localhost `<link>` stay live. They are additive; staging's copy of the
  rule remains.
- Fix: push and wait for staging, or temporarily comment out the `bv-css`
  link in the Embed.
- Status: documented (loader.html, AGENTS.md)
- Found by: human

### 2026-10-02 · Static localhost link is requested by public visitors
- Area: loader
- Scope: template-candidate
- Symptom: Published pages request `http://localhost:3000/styles.css`; can
  block render and trigger Chrome's local-network-access prompt.
- Cause: The canvas Embed carries a static localhost `<link>` so the
  Designer can see local CSS; the script that removes it runs after the
  browser has already started the request.
- Fix: reformd e9f81ab and regenx a66d116 removed the static link
  independently and create it from script only in dev mode. Trade-off: the
  canvas then shows staging CSS only.
- Status: open in template
- Found by: human

### 2026-10-02 · VER lives in two snippets and a placeholder 404s at launch
- Area: release
- Scope: template-candidate
- Symptom: Prod CSS and JS both 404 the moment a custom domain is attached.
- Cause: `VER = "X.Y.Z"` is never exercised on `*.webflow.io`, and a release
  must bump VER in both the Embed and the footer snippet.
- Fix: regenx keeps one `RELEASE` value in the head config (`null` until the
  first tag) that the other snippets read.
- Status: open
- Found by: human

### 2026-10-02 · The add -f dist / untrack release ritual is error-prone
- Area: release
- Scope: template-candidate
- Symptom: Empty release tags, re-cut versions, `dist/` swept into unrelated
  commits.
- Cause: `dist/` is gitignored except in release commits. terawulf re-cut
  v1.1.1 with a tree identical to v1.1.0.
- Fix: brandvm, adaria and nexplan commit `dist/` permanently and fail CI on
  `git diff --exit-code -- dist`.
- Status: open
- Found by: human

### 2026-10-02 · One throwing module leaves the page scroll-locked
- Area: js
- Scope: template-candidate
- Symptom: Page stays locked, or later modules never initialise.
- Cause: `src/index.ts` runs modules as a chain.
- Fix: reformdd and brandvm wrap each init in `run(name, init)` with
  try/catch; the template only has `finally` around the lock release.
- Status: partly fixed
- Found by: human

### 2026-10-02 · CDN `defer` scripts cannot be ordered against the bundle
- Area: js
- Scope: template-candidate
- Symptom: Lenis, GSAP or Finsweet is undefined when a module runs.
- Cause: The footer loader appends the bundle dynamically (async), so a
  sibling `<script defer>` has no ordering promise.
- Fix: bundle libraries with `pnpm add`. Do not also load Webflow's own GSAP
  or jQuery a second time.
- Status: documented
- Found by: human

### 2026-10-02 · Webflow's anchor scroll ignores a sticky header
- Area: js
- Scope: project
- Symptom: Same-page hash links land under a sticky nav.
- Cause: Webflow's scroll module offsets only for `position: fixed` headers
  and never reads `scroll-margin-top`.
- Fix: threestars `anchor-scroll.ts` unbinds `click.wf-scroll` and measures
  `--nav-h` from the nav.
- Status: project pattern
- Found by: human
